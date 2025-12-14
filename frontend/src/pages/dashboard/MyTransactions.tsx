import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api";
import type { BankTransaction, TransactionListParams } from "@/api/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Receipt, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Filter,
  Download
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MyTransactions() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    size: 20,
    total: 0,
  });
  const [stats, setStats] = useState({
    total_deposits: 0,
    total_payments: 0,
    pending_amount: 0,
    completed_amount: 0,
  });

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params: TransactionListParams = {
        skip: (pagination.page - 1) * pagination.size,
        limit: pagination.size,
      };

      if (filters.type !== "all") {
        params.transaction_type = filters.type;
      }
      if (filters.status !== "all") {
        params = filters.status;
      }
      if (filters.dateFrom) {
        params.from_date = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.to_date = filters.dateTo;
      }

      const response = await apiClient.bank.getMyTransactions(params);
      setTransactions(response.transactions);
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }));

      // Calculate stats
      const deposits = response.transactions.filter(t => t.transaction_type === "deposit");
      const payments = response.transactions.filter(t => t.transaction_type === "payment");
      const pending = response.transactions.filter(t => t.status === "pending");
      const completed = response.transactions.filter(t => t.status === "completed");

      setStats({
        total_deposits: deposits.reduce((sum, t) => sum + t.amount, 0),
        total_payments: payments.reduce((sum, t) => sum + t.amount, 0),
        pending_amount: pending.reduce((sum, t) => sum + t.amount, 0),
        completed_amount: completed.reduce((sum, t) => sum + t.amount, 0),
      });

    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải lịch sử giao dịch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, filters]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: JSX.Element }> = {
      pending: { variant: "secondary", label: "Đang xử lý", icon: <Clock className="w-3 h-3" /> },
      completed: { variant: "default", label: "Thành công", icon: <CheckCircle2 className="w-3 h-3" /> },
      failed: { variant: "destructive", label: "Thất bại", icon: <XCircle className="w-3 h-3" /> },
      cancelled: { variant: "outline", label: "Đã hủy", icon: <XCircle className="w-3 h-3" /> },
    };

    const config = statusMap[status] || statusMap.pending;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    return type === "deposit" ? (
      <ArrowDownCircle className="w-4 h-4 text-green-600" />
    ) : (
      <ArrowUpCircle className="w-4 h-4 text-blue-600" />
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

  const handleViewDetails = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setDetailsOpen(true);
  };

  const handleExport = () => {
    // Export to CSV logic
    const csv = [
      ["Mã GD", "Loại", "Số tiền", "Trạng thái", "Thời gian"].join(","),
      ...transactions.map((t) =>
        [
          t.transaction_id,
          t.transaction_type === "deposit" ? "Nạp tiền" : "Thanh toán",
          t.amount,
          t.status,
          t.created_at,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    toast({
      title: "Thành công",
      description: "Đã xuất file CSV",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="w-8 h-8" />
            Lịch sử giao dịch
          </h1>
          <p className="text-muted-foreground mt-1">
            Theo dõi tất cả giao dịch nạp tiền và thanh toán
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Xuất báo cáo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng nạp tiền
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.total_deposits)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.total_payments)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đang xử lý
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(stats.pending_amount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã hoàn thành
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.completed_amount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Bộ lọc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Loại giao dịch</label>
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="deposit">Nạp tiền</SelectItem>
                  <SelectItem value="payment">Thanh toán</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Trạng thái</label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Đang xử lý</SelectItem>
                  <SelectItem value="completed">Thành công</SelectItem>
                  <SelectItem value="failed">Thất bại</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Từ ngày</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Đến ngày</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách giao dịch ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Chưa có giao dịch nào</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã giao dịch</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Số tiền</TableHead>
                      <TableHead>Ngân hàng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.transaction_id}>
                        <TableCell className="font-mono text-sm">
                          {transaction.transaction_id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(transaction.transaction_type)}
                            <span>
                              {transaction.transaction_type === "deposit"
                                ? "Nạp tiền"
                                : "Thanh toán"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>{transaction.bank_code || "N/A"}</TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell className="text-sm">
                          {formatDate(transaction.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(transaction)}
                          >
                            Chi tiết
                          </Button>
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

      {/* Transaction Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết giao dịch</DialogTitle>
            <DialogDescription>
              Thông tin chi tiết về giao dịch #{selectedTransaction?.transaction_id}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mã giao dịch</p>
                  <p className="font-mono font-medium">{selectedTransaction.transaction_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loại giao dịch</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getTypeIcon(selectedTransaction.transaction_type)}
                    <span>
                      {selectedTransaction.transaction_type === "deposit"
                        ? "Nạp tiền"
                        : "Thanh toán"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Số tiền</p>
                  <p className="font-semibold text-lg">
                    {formatCurrency(selectedTransaction.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trạng thái</p>
                  <div className="mt-1">
                    {getStatusBadge(selectedTransaction.status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ngân hàng</p>
                  <p className="font-medium">{selectedTransaction.bank_code || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Thời gian tạo</p>
                  <p className="font-medium">{formatDate(selectedTransaction.created_at)}</p>
                </div>
                {selectedTransaction.auction_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Đấu giá</p>
                    <Link
                      to={`/auctions/${selectedTransaction.auction_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      #{selectedTransaction.auction_id}
                    </Link>
                  </div>
                )}
                {selectedTransaction.payment_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Thanh toán</p>
                    <p className="font-medium">#{selectedTransaction.payment_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
