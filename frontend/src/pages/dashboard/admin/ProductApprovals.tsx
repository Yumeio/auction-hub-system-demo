import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';
import type { ProductWithOwner } from '@/api/types';
import { Loader2, Check, X, Package } from 'lucide-react';

const getImageUrl = (path: string | null) => {
  if (!path) return null;
  const cleanPath = path.replace(/\\/g, '/');
  return apiClient.images.view(cleanPath);
};

export default function ProductApprovals() {
  const [products, setProducts] = useState<ProductWithOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; productId: number | null }>({ open: false, productId: null });
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchProducts = async () => {
    try {
      const response = await apiClient.products.getPending({ limit: 100 });
      const rawItems = response.data || [];
      const mappedProducts = rawItems.map((item: any) => ({
        ...item,
        image_url: getImageUrl(item.image_url),
        additional_images: Array.isArray(item.additional_images)
          ? item.additional_images.map((img: string) => getImageUrl(img)).filter((url: string | null): url is string => url !== null)
          : [],
      }));
      setProducts(mappedProducts);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleApprove = async (productId: number) => {
    setIsProcessing(true);
    try {
      await apiClient.products.approve(productId);
      toast({ title: 'Product approved' });
      fetchProducts();
    } catch (error: any) {
      toast({ title: 'Failed to approve', description: error.response?.data?.detail, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.productId) return;
    setIsProcessing(true);
    try {
      await apiClient.products.reject(rejectDialog.productId, { rejection_reason: rejectReason });
      toast({ title: 'Product rejected' });
      setRejectDialog({ open: false, productId: null });
      setRejectReason('');
      fetchProducts();
    } catch (error: any) {
      toast({ title: 'Failed to reject', description: error.response?.data?.detail, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Product Approvals</h1>
      {products.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><Package className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No pending products</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product.product_id}>
              <CardContent className="p-4 flex gap-4">
                <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-full h-full p-6" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{product.product_name}</h3>
                  <p className="text-sm text-muted-foreground">{product.product_type} • By {product.owner_username}</p>
                  <p className="text-sm mt-2 line-clamp-2">{product.product_description}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(product.product_id)} disabled={isProcessing}><Check className="h-4 w-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectDialog({ open: true, productId: product.product_id })} disabled={isProcessing}><X className="h-4 w-4 mr-1" />Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, productId: open ? rejectDialog.productId : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Product</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, productId: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing || !rejectReason}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
