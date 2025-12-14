import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "@/api";
import type { ProductWithOwner } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  ArrowLeft,
  Package,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Gavel,
  Eye,
  Heart,
} from "lucide-react";

export default function ProductDetails() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductWithOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  const fetchProduct = async () => {
    if (!productId) return;

    try {
      setLoading(true);
      const data = await apiClient.products.getById(parseInt(productId));
      setProduct(data);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin sản phẩm",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { 
      variant: "default" | "secondary" | "destructive" | "outline"; 
      label: string; 
      icon: JSX.Element 
    }> = {
      pending: { 
        variant: "secondary", 
        label: "Chờ duyệt", 
        icon: <Clock className="w-3 h-3" /> 
      },
      approved: { 
        variant: "default", 
        label: "Đã duyệt", 
        icon: <CheckCircle2 className="w-3 h-3" /> 
      },
      rejected: { 
        variant: "destructive", 
        label: "Từ chối", 
        icon: <XCircle className="w-3 h-3" /> 
      },
      in_auction: { 
        variant: "outline", 
        label: "Đang đấu giá", 
        icon: <Gavel className="w-3 h-3" /> 
      },
    };

    const config = statusMap[status] || statusMap.pending;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
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

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    toast({
      title: isFavorite ? "Đã xóa khỏi yêu thích" : "Đã thêm vào yêu thích",
      description: isFavorite 
        ? "Sản phẩm đã được xóa khỏi danh sách yêu thích" 
        : "Sản phẩm đã được thêm vào danh sách yêu thích",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Không tìm thấy sản phẩm</p>
            <Link to="/auctions">
              <Button className="mt-4">Khám phá đấu giá</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              {product.imageUrl && product.additionalImages.length > 0 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {product.additionalImages.map((image, index) => (
                      <CarouselItem key={index}>
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                          <img
                            src={image}
                            alt={`${product.productName} - ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {product.additionalImages.length > 1 && (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  )}
                </Carousel>
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <Package className="w-24 h-24 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Thumbnail Grid */}
          {product.additionalImages && product.additionalImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.additionalImages.slice(0, 4).map((image, index) => (
                <div
                  key={index}
                  className="aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Information */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-3xl font-bold">{product.productName}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFavorite}
                className={isFavorite ? "text-red-500" : ""}
              >
                <Heart className={`w-6 h-6 ${isFavorite ? "fill-current" : ""}`} />
              </Button>
            </div>
            {getStatusBadge(product.approvalStatus)}
          </div>

          <Separator />

          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Mô tả sản phẩm</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {product.productDescription}
            </p>
          </div>

          <Separator />

          {/* Product Details */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Thông tin chi tiết</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Danh mục
                </p>
                <p className="font-medium mt-1">{product.productType || "Chưa phân loại"}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Ngày tạo
                </p>
                <p className="font-medium mt-1">{formatDate(product.createdAt)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Owner Information */}
          {/* {product.owner && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Thông tin người bán</h2>
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${product.ownerID}`} />
                  <AvatarFallback>
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{product.ownerID}</p>
                </div>
              </div>
            </div>
          )} */}

          <Separator />

          {/* Actions */}
          <div className="flex gap-4">
            {product.approvalStatus === "approved" && (
              <Button className="flex-1" size="lg">
                <Gavel className="w-4 h-4 mr-2" />
                Tham gia đấu giá
              </Button>
            )}
            
            <Button variant="outline" className="flex-1" size="lg">
              <Eye className="w-4 h-4 mr-2" />
              Theo dõi
            </Button>
          </div>

          {/* Related Auctions */}
          {product.approvalStatus === "in_auction" && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <Gavel className="w-5 h-5 text-blue-600" />
                  <p className="font-semibold text-blue-900">
                    Sản phẩm đang được đấu giá
                  </p>
                </div>
                <p className="text-sm text-blue-700 mb-4">
                  Sản phẩm này hiện đang trong một phiên đấu giá đang diễn ra.
                </p>
                <Link to="/auctions">
                  <Button variant="outline" className="border-blue-300">
                    Xem phiên đấu giá
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {product.approvalStatus === "rejected" && product.rejectionReason && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <p className="font-semibold text-red-900">Sản phẩm bị từ chối</p>
                </div>
                <p className="text-sm text-red-700">
                  Lý do: {product.rejectionReason}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Additional Information Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin bổ sung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Điều khoản và điều kiện</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Sản phẩm được bảo hành theo quy định của nhà sản xuất</li>
              <li>Người mua chịu trách nhiệm về chi phí vận chuyển</li>
              <li>Vui lòng kiểm tra kỹ sản phẩm trước khi nhận hàng</li>
              <li>Không hỗ trợ đổi trả sau khi đã nhận hàng</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">Chính sách thanh toán</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Thanh toán qua chuyển khoản ngân hàng</li>
              <li>Cần thanh toán trong vòng 24 giờ sau khi thắng đấu giá</li>
              <li>Tiền cọc sẽ được hoàn trả nếu không thắng đấu giá</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
