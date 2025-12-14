import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api";
import type { Auction, AuctionSearch, SearchAuctionsParams } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { AuctionCard } from "@/components/auction/AuctionCard";
import {
  Search,
  SlidersHorizontal,
  X,
  Filter,
  TrendingUp,
  Clock,
  DollarSign,
  Calendar,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const CATEGORIES = [
  "Điện tử",
  "Thời trang",
  "Nội thất",
  "Phương tiện",
  "Nghệ thuật",
  "Sưu tầm",
  "Đồ cổ",
  "Khác",
];

const SORT_OPTIONS = [
  { value: "end_time_asc", label: "Kết thúc sớm nhất" },
  { value: "end_time_desc", label: "Kết thúc muộn nhất" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
  { value: "created_desc", label: "Mới nhất" },
  { value: "created_asc", label: "Cũ nhất" },
];

export default function AdvancedSearch() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);

  // Search filters
  const [filters, setFilters] = useState<{
    query: string;
    categories: string[];
    status: string[];
    minPrice: number;
    maxPrice: number;
    startDateFrom: string;
    startDateTo: string;
    endDateFrom: string;
    endDateTo: string;
    sortBy: string;
  }>({
    query: "",
    categories: [],
    status: [],
    minPrice: 0,
    maxPrice: 100000000,
    startDateFrom: "",
    startDateTo: "",
    endDateFrom: "",
    endDateTo: "",
    sortBy: "end_time_asc",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    size: 12,
    total: 0,
  });

  const [stats, setStats] = useState({
    total_results: 0,
    active_auctions: 0,
    avg_price: 0,
    ending_soon: 0,
  });

  const handleSearch = async () => {
    try {
      setLoading(true);

      const searchData: AuctionSearch = {};
      
      if (filters.query.trim()) {
        searchData.query = filters.query.trim();
      }
      
      if (filters.categories.length > 0) {
        searchData. = filters.categories;
      }
      
      if (filters.status.length > 0) {
        searchData.auctionStatus = filters.status;
      }
      
      if (filters.minPrice > 0) {
        searchData.minPrice = filters.minPrice;
      }
      
      if (filters.maxPrice < 100000000) {
        searchData.maxPrice = filters.maxPrice;
      }
      
      if (filters.startDateFrom) {
        searchData.startDateFrom = filters.startDateFrom;
      }
      
      if (filters.startDateTo) {
        searchData.startDateTo = filters.startDateTo;
      }
      
      if (filters.endDateFrom) {
        searchData.endDateFrom = filters.endDateFrom;
      }
      
      if (filters.endDateTo) {
        searchData.endDateTo = filters.endDateTo;
      }

      const params = {
        skip: (pagination.page - 1) * pagination.size,
        limit: pagination.size,
      };

      const response = await apiClient.search.auctions(searchData, params);
      setAuctions(response.auctions);
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }));

      // Calculate stats
      const activeAuctions = response.auctions.filter(a => a.status === "active").length;
      const avgPrice = response.auctions.length > 0
        ? response.auctions.reduce((sum, a) => sum + a.current_price, 0) / response.auctions.length
        : 0;
      const endingSoon = response.auctions.filter(a => {
        const endTime = new Date(a.end_time).getTime();
        const now = Date.now();
        return endTime - now < 24 * 60 * 60 * 1000; // 24 hours
      }).length;

      setStats({
        total_results: response.total,
        active_auctions: activeAuctions,
        avg_price: avgPrice,
        ending_soon: endingSoon,
      });

    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tìm kiếm đấu giá",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, [pagination.page, filters.sortBy]);

  const handleCategoryToggle = (category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleStatusToggle = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: "",
      categories: [],
      status: [],
      minPrice: 0,
      maxPrice: 100000000,
      startDateFrom: "",
      startDateTo: "",
      endDateFrom: "",
      endDateTo: "",
      sortBy: "end_time_asc",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Search className="w-8 h-8" />
          Tìm kiếm nâng cao
        </h1>
        <p className="text-muted-foreground mt-1">
          Tìm kiếm đấu giá với nhiều bộ lọc chi tiết
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Search className="w-4 h-4" />
              Kết quả tìm kiếm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_results}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Đang diễn ra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active_auctions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Giá trung bình
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats.avg_price)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Sắp kết thúc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.ending_soon}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5" />
                  Bộ lọc
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Xóa
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search Query */}
              <div className="space-y-2">
                <Label htmlFor="search-query">Từ khóa</Label>
                <Input
                  id="search-query"
                  placeholder="Tìm kiếm..."
                  value={filters.query}
                  onChange={(e) =>
                    setFilters({ ...filters, query: e.target.value })
                  }
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>

              <Separator />

              {/* Categories */}
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <Label className="cursor-pointer">Danh mục</Label>
                  <Filter className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2">
                  {CATEGORIES.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={filters.categories.includes(category)}
                        onCheckedChange={() => handleCategoryToggle(category)}
                      />
                      <label
                        htmlFor={`category-${category}`}
                        className="text-sm cursor-pointer"
                      >
                        {category}
                      </label>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Status */}
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <Label className="cursor-pointer">Trạng thái</Label>
                  <Filter className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2">
                  {["scheduled", "active", "completed"].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.status.includes(status)}
                        onCheckedChange={() => handleStatusToggle(status)}
                      />
                      <label
                        htmlFor={`status-${status}`}
                        className="text-sm cursor-pointer"
                      >
                        {status === "scheduled" && "Đã lên lịch"}
                        {status === "active" && "Đang diễn ra"}
                        {status === "completed" && "Hoàn thành"}
                      </label>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Price Range */}
              <div className="space-y-4">
                <Label>Khoảng giá</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatCurrency(filters.minPrice)}</span>
                    <span>{formatCurrency(filters.maxPrice)}</span>
                  </div>
                  <Slider
                    min={0}
                    max={100000000}
                    step={1000000}
                    value={[filters.minPrice, filters.maxPrice]}
                    onValueChange={([min, max]) =>
                      setFilters({ ...filters, minPrice: min, maxPrice: max })
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Date Filters */}
              <div className="space-y-4">
                <Label>Thời gian bắt đầu</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="start-from" className="text-xs">Từ</Label>
                    <Input
                      id="start-from"
                      type="date"
                      value={filters.startDateFrom}
                      onChange={(e) =>
                        setFilters({ ...filters, startDateFrom: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="start-to" className="text-xs">Đến</Label>
                    <Input
                      id="start-to"
                      type="date"
                      value={filters.startDateTo}
                      onChange={(e) =>
                        setFilters({ ...filters, startDateTo: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Thời gian kết thúc</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="end-from" className="text-xs">Từ</Label>
                    <Input
                      id="end-from"
                      type="date"
                      value={filters.endDateFrom}
                      onChange={(e) =>
                        setFilters({ ...filters, endDateFrom: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-to" className="text-xs">Đến</Label>
                    <Input
                      id="end-to"
                      type="date"
                      value={filters.endDateTo}
                      onChange={(e) =>
                        setFilters({ ...filters, endDateTo: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSearch} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Đang tìm...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Tìm kiếm
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-6">
          {/* Sort and View Options */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {auctions.length} trong {pagination.total} kết quả
                </p>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Sắp xếp:</Label>
                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) =>
                      setFilters({ ...filters, sortBy: value })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auction Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner className="w-8 h-8" />
            </div>
          ) : auctions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Không tìm thấy kết quả</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm
                </p>
                <Button onClick={clearFilters}>Xóa bộ lọc</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {auctions.map((auction) => (
                  <AuctionCard key={auction.auctionID} auction={auction} />
                ))}
              </div>

              {/* Pagination */}
              {pagination.total > pagination.size && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Trang {pagination.page} / {Math.ceil(pagination.total / pagination.size)}
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
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
