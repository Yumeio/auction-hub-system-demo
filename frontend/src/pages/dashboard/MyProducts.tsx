import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api';
import type { ProductWithOwner } from '@/api/types';
import { Loader2, Plus, Package, ExternalLink, Gavel } from 'lucide-react';

const getImageUrl = (path: string | null) => {
  if (!path) return null;
  const cleanPath = path.replace(/\\/g, '/');
  return apiClient.images.view(cleanPath);
};

export default function MyProducts() {
  const [products, setProducts] = useState<ProductWithOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await apiClient.products.list({ limit: 100 });
        const rawItems = response.data || [];
        const mappedProducts: ProductWithOwner[] = rawItems.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_description: item.product_description,
          product_type: item.product_type,
          image_url: getImageUrl(item.image_url),
          additional_images: Array.isArray(item.additional_images)
            ? item.additional_images.map((img: string) => getImageUrl(img)).filter((url): url is string => url !== null)
            : [],
          approval_status: item.approval_status,
          shipping_status: item.shipping_status,
          rejection_reason: item.rejection_reason,
          suggested_by_user_id: item.suggested_by_user_id,
          created_at: item.created_at,
        }))
        console.log("DEBUG - Mapped Products:", mappedProducts)
        setProducts(mappedProducts);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/10 text-green-600';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Products</h1>
          <p className="text-muted-foreground">
            Manage your products and auction listings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard/auctions/new">
              <Gavel className="mr-2 h-4 w-4" />
              Create Auction
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">No products yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start by adding your first product to auction
            </p>
            <Button asChild>
              <Link to="/dashboard/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.product_id} className="overflow-hidden">
              <div className="aspect-video relative bg-muted">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <Badge
                  className={`absolute top-2 right-2 ${getStatusColor(product.approval_status as string || 'pending')}`}
                >
                  {product.approval_status}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium truncate">{product.product_name}</h3>
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {product.product_type}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {formatPrice(product.initial_price || 0)}
                  </span>
                  <div className="flex gap-1">
                    {product.approval_status === 'approved' && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/dashboard/auctions/new?productId=${product.product_id}`}>
                          <Gavel className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/dashboard/products/${product.product_id}`}>
                        View
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
                {product.rejection_reason && (
                  <p className="text-xs text-destructive mt-2">
                    Rejected: {product.rejection_reason}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
