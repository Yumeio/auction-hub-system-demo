import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/api";
import type { Participation, AuctionDetailResponse } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ParticipantWithStats extends Participation {
  username?: string;
  email?: string;
  total_bids?: number;
  highest_bid?: number;
  last_bid_time?: string;
}

export default function AuctionParticipants() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [auction, setAuction] = useState<AuctionDetailResponse | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithStats[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithStats | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [stats, setStats] = useState({
    total_participants: 0,
    active_bidders: 0,
    total_bids: 0,
    average_bids_per_user: 0,
  });

  const fetchData = async () => {
    if (!auctionId) return;

    try {
      setLoading(true);
      
      // Fetch auction details
      const auctionData = await apiClient.auctions.getById(parseInt(auctionId));
      setAuction(auctionData);

      // Fetch participants
      const participantsData = await apiClient.participations.getAuctionParticipants(
        parseInt(auctionId)
      );

      // Fetch bids to calculate stats
      const bidsData = await apiClient.bids.getAuctionBids(parseInt(auctionId));

      // Enrich participants with bid stats
      const enrichedParticipants: ParticipantWithStats[] = participantsData.participants.map(
        (participant) => {
          const userBids = bidsData.bids.filter(
            (bid) => bid.user_id === participant.user_id
          );
          const highestBid = userBids.length > 0
            ? Math.max(...userBids.map((bid) => bid.amount))
            : 0;
          const lastBid = userBids.length > 0
            ? userBids.sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0]
            : null;

          return {
            ...participant,
            username: `User #${participant.user_id}`,
            email: `user${participant.user_id}@example.com`,
            total_bids: userBids.length,
            highest_bid: highestBid,
            last_bid_time: lastBid?.created_at,
          };
        }
      );

      setParticipants(enrichedParticipants);
      setFilteredParticipants(enrichedParticipants);

      // Calculate stats
      const activeBidders = enrichedParticipants.filter((p) => p.total_bids && p.total_bids > 0).length;
      const totalBids = enrichedParticipants.reduce((sum, p) => sum + (p.total_bids || 0), 0);

      setStats({
        total_participants: enrichedParticipants.length,
        active_bidders: activeBidders,
        total_bids: totalBids,
        average_bids_per_user: activeBidders > 0 ? totalBids / activeBidders : 0,
      });

    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách người tham gia",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [auctionId]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredParticipants(participants);
    } else {
      const filtered = participants.filter(
        (p) =>
          p.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredParticipants(filtered);
    }
  }, [searchQuery, participants]);

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

  const getDepositStatusBadge = (hasDeposit: boolean) => {
    return hasDeposit ? (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Đã đặt cọc
      </Badge>
    ) : (
      <Badge variant="secondary" className="flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Chưa đặt cọc
      </Badge>
    );
  };

  const handleViewDetails = (participant: ParticipantWithStats) => {
    setSelectedParticipant(participant);
    setDetailsOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Người tham gia đấu giá
          </h1>
          <p className="text-muted-foreground mt-1">
            {auction?.auction.title || "Đang tải..."}
          </p>
        </div>
        <Link to={`/auctions/${auctionId}`}>
          <Button variant="outline">Quay lại đấu giá</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Tổng người tham gia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_participants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Người đã đặt giá
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active_bidders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total_participants > 0
                ? `${((stats.active_bidders / stats.total_participants) * 100).toFixed(1)}% tổng số`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Tổng số lượt đặt giá
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_bids}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              TB lượt/người
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.average_bids_per_user.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Tìm kiếm người tham gia..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Participants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách người tham gia ({filteredParticipants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "Không tìm thấy người tham gia" : "Chưa có người tham gia"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Thời gian đăng ký</TableHead>
                    <TableHead>Trạng thái cọc</TableHead>
                    <TableHead className="text-center">Số lượt đặt</TableHead>
                    <TableHead>Giá cao nhất</TableHead>
                    <TableHead>Lần đặt cuối</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.user_id}`} />
                            <AvatarFallback>
                              {participant.username?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{participant.username}</p>
                            <p className="text-xs text-muted-foreground">ID: {participant.user_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{participant.email}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(participant.registered_at)}
                      </TableCell>
                      <TableCell>{getDepositStatusBadge(participant.deposit_paid)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{participant.total_bids || 0}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {participant.highest_bid
                          ? formatCurrency(participant.highest_bid)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {participant.last_bid_time
                          ? formatDate(participant.last_bid_time)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(participant)}
                        >
                          Chi tiết
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participant Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thông tin người tham gia</DialogTitle>
            <DialogDescription>
              Chi tiết về hoạt động trong phiên đấu giá
            </DialogDescription>
          </DialogHeader>
          {selectedParticipant && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedParticipant.user_id}`} />
                  <AvatarFallback>
                    {selectedParticipant.username?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedParticipant.username}</h3>
                  <p className="text-sm text-muted-foreground">{selectedParticipant.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Thời gian đăng ký</p>
                  <p className="font-medium">{formatDate(selectedParticipant.registered_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trạng thái cọc</p>
                  <div className="mt-1">
                    {getDepositStatusBadge(selectedParticipant.deposit_paid)}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tổng số lượt đặt</p>
                  <p className="font-semibold text-lg">{selectedParticipant.total_bids || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Giá đặt cao nhất</p>
                  <p className="font-semibold text-lg text-green-600">
                    {selectedParticipant.highest_bid
                      ? formatCurrency(selectedParticipant.highest_bid)
                      : "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Lần đặt giá cuối cùng</p>
                  <p className="font-medium">
                    {selectedParticipant.last_bid_time
                      ? formatDate(selectedParticipant.last_bid_time)
                      : "Chưa đặt giá"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  Xem lịch sử đặt giá
                </Button>
                <Button className="flex-1">
                  Gửi tin nhắn
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
