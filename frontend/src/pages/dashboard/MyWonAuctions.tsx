import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api";
import type { Bid, BidWithDetails } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import { Trophy, Eye, CreditCard, Package, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WonAuction {
  auction_id: number;
  auction_title: string;
  product_name: string;
  winning_bid: number;
  end_time: string;
  payment_status: "pending" | "deposit_paid" | "completed";
  delivery_status: "pending" | "processing" | "shipped" | "delivered";
}

export default function MyWonAuctions() {
  const [wonAuctions, setWonAuctions] = useState<WonAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    pending_payment: 0,
    paid: 0,
    delivered: 0,
  });

  const fetchWonAuctions = async () => {
    try {
      setLoading(true);
      // Lấy tất cả bids của user
      const bidsResponse = await apiClient.bids.getMyBids();
      
      // Filter các bid đã thắng (winning bids)
      const wonBids = bidsResponse.items.filter(
        (bid: BidWithDetails) => bid.bidStatus === "won"
      );

      // Tạo mock data cho won auctions (trong thực tế sẽ lấy từ API)
      const mockWonAuctions: WonAuction[] = wonBids.map((bid: BidWithDetails) => ({
        auction_id: bid.auctionID,
        auction_title: `Đấu giá #${bid.auctionID}`,
        product_name: `Sản phẩm #${bid.auctionID}`,
        winning_bid: bid.bidPrice,
        end_time: new Date().toISOString(),
        payment_status: Math.random() > 0.5 ? "completed" : "pending",
        delivery_status: Math.random() > 0.7 ? "delivered" : "pending",
      }));

      setWonAuctions(mockWonAuctions);

      // Calculate stats
      const stats = {
        total: mockWonAuctions.length,
        pending_payment: mockWonAuctions.filter(a => a.payment_status === "pending").length,
        paid: mockWonAuctions.filter(a => a.payment_status === "completed").length,
        delivered: mockWonAuctions.filter(a => a.delivery_status === "delivered").length,
      };
      setStats(stats);

    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách đấu giá đã thắng",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWonAuctions();
  }, []);

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: JSX.Element }> = {
      pending: { variant: "destructive", label: "Chưa thanh toán", icon: <AlertCircle className="w-3 h-3" /> },
      deposit_paid: { variant: "secondary", label: "Đã đặt cọc", icon: <Clock className="w-3 h-3" /> },
      completed: { variant: "default", label: "Đã thanh toán", icon: <CheckCircle2 className="w-3 h-3" /> },
    };

    const config = statusMap[status] || statusMap.pending;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getDeliveryStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: JSX.Element }> = {
      pending: { variant: "outline", label: "Chờ xử lý", icon: <Clock className="w-3 h-3" /> },
      processing: { variant: "secondary", label: "Đang xử lý", icon: <Package className="w-3 h-3" /> },
      shipped: { variant: "default", label: "Đang giao hàng", icon: <Package className="w-3 h-3" /> },
      delivered: { variant: "default", label: "Đã giao hàng", icon: <CheckCircle2 className="w-3 h-3" /> },
    };

    const config = statusMap[status] || statusMap.pending;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredAuctions = wonAuctions.filter((auction) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending_payment") return auction.payment_status === "pending";
    if (activeTab === "paid") return auction.payment_status === "completed";
    if (activeTab === "delivered") return auction.delivery_status === "delivered";
    return true;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Đấu giá đã thắng
          </h1>
          <p className="text-muted-foreground mt-1">
            Danh sách các phiên đấu giá bạn đã thắng
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng số đấu giá thắng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chờ thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.pending_payment}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã nhận hàng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.delivered}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="pending_payment">Chờ thanh toán</TabsTrigger>
          <TabsTrigger value="paid">Đã thanh toán</TabsTrigger>
          <TabsTrigger value="delivered">Đã nhận hàng</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Danh sách đấu giá ({filteredAuctions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Spinner className="w-8 h-8" />
                </div>
              ) : filteredAuctions.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === "all"
                      ? "Bạn chưa thắng đấu giá nào"
                      : "Không có đấu giá nào trong mục này"}
                  </p>
                  <Link to="/auctions">
                    <Button className="mt-4">Tham gia đấu giá</Button>
                  </Link>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Đấu giá</TableHead>
                        <TableHead>Sản phẩm</TableHead>
                        <TableHead>Giá trúng</TableHead>
                        <TableHead>Thời gian kết thúc</TableHead>
                        <TableHead>Thanh toán</TableHead>
                        <TableHead>Giao hàng</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAuctions.map((auction) => (
                        <TableRow key={auction.auction_id}>
                          <TableCell className="font-medium">
                            {auction.auction_title}
                          </TableCell>
                          <TableCell>{auction.product_name}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(auction.winning_bid)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(auction.end_time)}
                          </TableCell>
                          <TableCell>
                            {getPaymentStatusBadge(auction.payment_status)}
                          </TableCell>
                          <TableCell>
                            {getDeliveryStatusBadge(auction.delivery_status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Link to={`/auctions/${auction.auction_id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4 mr-1" />
                                  Chi tiết
                                </Button>
                              </Link>
                              {auction.payment_status === "pending" && (
                                <Link to={`/dashboard/payments/${auction.auction_id}`}>
                                  <Button size="sm">
                                    <CreditCard className="w-4 h-4 mr-1" />
                                    Thanh toán
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
