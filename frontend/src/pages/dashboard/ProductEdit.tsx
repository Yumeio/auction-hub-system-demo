import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "@/api";
import type { Product, ProductCreate } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  Save,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  Plus,
} from "lucide-react";

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

export default function ProductEdit() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const fetchProduct = async () => {
    if (!productId) return;

    try {
      setLoading(true);
      const data = await apiClient.products.getById(parseInt(productId));
      setProduct(data);
      setFormData({
        name: data.productName,
        description: data.productDescription,
        category: data.productType|| "",
      });
      setImages(data.imageUrl || []);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin sản phẩm",
        variant: "destructive",
      });
      navigate("/dashboard/my-products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types and sizes
    const validFiles = files.filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isUnder5MB = file.size <= 5 * 1024 * 1024;
      
      if (!isImage) {
        toast({
          title: "Lỗi",
          description: `${file.name} không phải là file ảnh`,
          variant: "destructive",
        });
      }
      if (!isUnder5MB) {
        toast({
          title: "Lỗi",
          description: `${file.name} vượt quá 5MB`,
          variant: "destructive",
        });
      }
      
      return isImage && isUnder5MB;
    });

    if (validFiles.length === 0) return;

    // Create previews
    const previews = validFiles.map((file) => URL.createObjectURL(file));
    
    setNewImages([...newImages, ...validFiles]);
    setImagePreviews([...imagePreviews, ...previews]);
  };

  const removeExistingImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setNewImages(newImages.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId) return;

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên sản phẩm",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mô tả sản phẩm",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Upload new images if any
      let uploadedImageUrls: string[] = [];
      if (newImages.length > 0) {
        const uploadResponse = await apiClient.images.uploadMultiple(
          newImages,
          parseInt(productId)
        );
        uploadedImageUrls = uploadResponse.image_urls;
      }

      // Update product
      const updateData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        images: [...images, ...uploadedImageUrls],
      };

      await apiClient.products.update(parseInt(productId), updateData as ProductCreate);

      toast({
        title: "Thành công",
        description: "Đã cập nhật sản phẩm",
      });

      navigate("/dashboard/my-products");
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.detail || "Không thể cập nhật sản phẩm",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productId) return;

    try {
      await apiClient.products.delete(parseInt(productId));
      toast({
        title: "Thành công",
        description: "Đã xóa sản phẩm",
      });
      navigate("/dashboard/my-products");
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa sản phẩm",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup image previews
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  // Check if product can be edited
  const canEdit = product.approvalStatus === "pending" || product.approvalStatus === "rejected";

  if (!canEdit) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              Không thể chỉnh sửa sản phẩm đã được duyệt hoặc đang trong đấu giá
            </p>
            <Link to="/dashboard/my-products">
              <Button>Quay lại danh sách</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard/my-products")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Chỉnh sửa sản phẩm</h1>
            <p className="text-muted-foreground mt-1">
              Cập nhật thông tin sản phẩm của bạn
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Xóa sản phẩm
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin cơ bản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Tên sản phẩm <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nhập tên sản phẩm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Danh mục</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Mô tả <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Nhập mô tả chi tiết về sản phẩm"
                rows={6}
                required
              />
              <p className="text-sm text-muted-foreground">
                {formData.description.length} ký tự
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle>Hình ảnh sản phẩm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Images */}
            {images.length > 0 && (
              <div>
                <Label className="mb-3 block">Hình ảnh hiện tại</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`Current ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeExistingImage(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Images */}
            {imagePreviews.length > 0 && (
              <div>
                <Label className="mb-3 block">Hình ảnh mới</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                        <img
                          src={preview}
                          alt={`New ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeNewImage(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div>
              <Label
                htmlFor="images"
                className="cursor-pointer inline-flex items-center justify-center rounded-md border border-dashed border-muted-foreground/25 bg-background px-4 py-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground w-full"
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span>Tải lên hình ảnh</span>
                  <span className="text-xs text-muted-foreground">
                    PNG, JPG, GIF (tối đa 5MB)
                  </span>
                </div>
              </Label>
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 justify-end">
              <Link to="/dashboard/my-products">
                <Button type="button" variant="outline" disabled={saving}>
                  Hủy
                </Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Lưu thay đổi
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa sản phẩm "{product.name}"? Hành động này không thể hoàn tác.
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
