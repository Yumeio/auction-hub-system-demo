import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api";
import type { Auction, AuctionListParams } from "@/api/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Edit, Trash2, Eye, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function MyAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 10,
    total: 0,
  });

  const fetchAuctions = async (status?: string) => {
    try {
      setLoading(true);
      const params: AuctionListParams = {
        skip: (pagination.page - 1) * pagination.size,
        limit: pagination.size,
      };

      if (status && status !== "all") {
        params.status = status;
      }

      const response = await apiClient.auctions.getMyAuctions(params);
      setAuctions(response.auctions);
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }));
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách đấu giá",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions(activeTab);
  }, [activeTab, pagination.page]);

  const handleDelete = async () => {
    if (!selectedAuction) return;

    try {
      await apiClient.auctions.delete(selectedAuction.auctionID);
      toast({
        title: "Thành công",
        description: "Đã xóa đấu giá",
      });
      fetchAuctions(activeTab);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa đấu giá",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedAuction(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: JSX.Element }> = {
      pending: { variant: "secondary", label: "Chờ duyệt", icon: <Clock className="w-3 h-3" /> },
      scheduled: { variant: "outline", label: "Đã lên lịch", icon: <Clock className="w-3 h-3" /> },
      active: { variant: "default", label: "Đang diễn ra", icon: <CheckCircle2 className="w-3 h-3" /> },
      completed: { variant: "secondary", label: "Hoàn thành", icon: <CheckCircle2 className="w-3 h-3" /> },
      cancelled: { variant: "destructive", label: "Đã hủy", icon: <XCircle className="w-3 h-3" /> },
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Đấu giá của tôi</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý các phiên đấu giá bạn đã tạo
          </p>
        </div>
        <Link to="/dashboard/create-auction">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Tạo đấu giá mới
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="pending">Chờ duyệt</TabsTrigger>
          <TabsTrigger value="scheduled">Đã lên lịch</TabsTrigger>
          <TabsTrigger value="active">Đang diễn ra</TabsTrigger>
          <TabsTrigger value="completed">Hoàn thành</TabsTrigger>
          <TabsTrigger value="cancelled">Đã hủy</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Danh sách đấu giá ({pagination.total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Spinner className="w-8 h-8" />
                </div>
              ) : auctions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Chưa có đấu giá nào</p>
                  <Link to="/dashboard/create-auction">
                    <Button className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Tạo đấu giá đầu tiên
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên đấu giá</TableHead>
                          <TableHead>Sản phẩm</TableHead>
                          <TableHead>Giá khởi điểm</TableHead>
                          <TableHead>Giá hiện tại</TableHead>
                          <TableHead>Bắt đầu</TableHead>
                          <TableHead>Kết thúc</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auctions.map((auction) => (
                          <TableRow key={auction.auctionID}>
                            <TableCell className="font-medium">
                              {auction.auctionName}
                            </TableCell>
                            <TableCell>{auction.productID}</TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(auction.priceStep)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(auction.createdAt)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(auction.endDate)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(auction.auctionStatus)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <Link to={`/auctions/${auction.auctionID}`}>
                                    <DropdownMenuItem>
                                      <Eye className="w-4 h-4 mr-2" />
                                      Xem chi tiết
                                    </DropdownMenuItem>
                                  </Link>
                                  {auction.auctionStatus === "pending" && (
                                    <Link to={`/dashboard/auctions/${auction.auctionID}/edit`}>
                                      <DropdownMenuItem>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Chỉnh sửa
                                      </DropdownMenuItem>
                                    </Link>
                                  )}
                                  {auction.auctionStatus === "completed" && (
                                    <Link to={`/dashboard/auctions/${auction.auctionID}/complete`}>
                                      <DropdownMenuItem>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Hoàn tất
                                      </DropdownMenuItem>
                                    </Link>
                                  )}
                                  {(auction.auctionStatus === "pending" || auction.auctionStatus === "scheduled") && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => {
                                        setSelectedAuction(auction);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Xóa
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {pagination.total > pagination.size && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Hiển thị {(pagination.page - 1) * pagination.size + 1} -{" "}
                        {Math.min(pagination.page * pagination.size, pagination.total)} trong tổng số {pagination.total}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pagination.page === 1}
                          onClick={() =>
                            setPagination((prev) => ({
                              ...prev,
                              page: prev.page - 1,
                            }))
                          }
                        >
                          Trước
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            pagination.page * pagination.size >= pagination.total
                          }
                          onClick={() =>
                            setPagination((prev) => ({
                              ...prev,
                              page: prev.page + 1,
                            }))
                          }
                        >
                          Sau
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa đấu giá "{selectedAuction?.auctionName}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
