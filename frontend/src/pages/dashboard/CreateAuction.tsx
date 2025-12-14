import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, setHours, setMinutes } from 'date-fns';
import { CalendarIcon, Loader2, ArrowLeft, Gavel, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';
import { toast } from 'sonner';
import { apiClient } from '@/api';
import type { ProductWithOwner } from '@/api/types';
import { cn } from '@/lib/utils';

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  const cleanPath = path.replace(/\\/g, '/');
  return apiClient.images.view(cleanPath);
};

export default function CreateAuction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  const [products, setProducts] = useState<ProductWithOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string>(preselectedProductId || '');
  const [auctionName, setAuctionName] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [startTime, setStartTime] = useState({ hours: 9, minutes: 0 });
  const [endDate, setEndDate] = useState<Date>();
  const [endTime, setEndTime] = useState({ hours: 18, minutes: 0 });
  const [priceStep, setPriceStep] = useState('');

  useEffect(() => {
    const fetchApprovedProducts = async () => {
      try {
        const response = await apiClient.products.list({ limit: 100 });
        // Filter only approved products
        const approvedProducts = response.data.filter(
          (p) => p.approval_status === 'approved'
        );
        setProducts(approvedProducts);

        // If preselected product, set auction name
        if (preselectedProductId) {
          const product = approvedProducts.find(
            (p) => p.product_id.toString() === preselectedProductId
          );
          if (product) {
            setAuctionName(`Auction for ${product.product_name}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        toast.error('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApprovedProducts();
  }, [preselectedProductId]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((p) => p.product_id.toString() === productId);
    if (product && !auctionName) {
      setAuctionName(`Auction for ${product.product_name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !auctionName || !startDate || !endDate || !priceStep) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Combine date and time
    const startDateTime = setMinutes(setHours(startDate, startTime.hours), startTime.minutes);
    const endDateTime = setMinutes(setHours(endDate, endTime.hours), endTime.minutes);

    if (startDateTime >= endDateTime) {
      toast.error('End date/time must be after start date/time');
      return;
    }

    if (startDateTime < new Date()) {
      toast.error('Start date/time must be in the future');
      return;
    }

    const priceStepNum = parseFloat(priceStep);
    if (isNaN(priceStepNum) || priceStepNum <= 0) {
      toast.error('Price step must be a positive number');
      return;
    }

    const durationInHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    if (durationInHours < 1) {
      toast.error('Auction duration must be at least 1 hour');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.auctions.create({
        auctionName,
        productID: parseInt(selectedProductId),
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        priceStep: priceStepNum,
      });

      toast.success('Auction created successfully!');
      navigate('/dashboard/products');
    } catch (error: any) {
      console.error('Failed to create auction:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to create auction. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find(
    (p) => p.product_id.toString() === selectedProductId
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Auction</h1>
          <p className="text-muted-foreground">
            Set up an auction for your approved product
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Gavel className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">No approved products</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You need at least one approved product to create an auction
            </p>
            <Button onClick={() => navigate('/dashboard/products/new')}>
              Submit a Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Auction Details</CardTitle>
                <CardDescription>
                  Configure your auction settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="product">Select Product *</Label>
                    <Select
                      value={selectedProductId}
                      onValueChange={handleProductChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a product to auction" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {products.map((product) => (
                          <SelectItem
                            key={product.product_id}
                            value={product.product_id.toString()}
                          >
                            {product.product_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auctionName">Auction Name *</Label>
                    <Input
                      id="auctionName"
                      value={auctionName}
                      onChange={(e) => setAuctionName(e.target.value)}
                      placeholder="Enter auction name"
                      maxLength={100}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Start Date *</Label>
                      <Popover modal={true}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !startDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="p-3"
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <TimePicker value={startTime} onChange={setStartTime} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>End Date *</Label>
                      <Popover modal={true}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !endDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            disabled={(date) =>
                              date < new Date() || (startDate && date <= startDate)
                            }
                            initialFocus
                            className="p-3"
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <TimePicker value={endTime} onChange={setEndTime} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priceStep">Price Step (Bid Increment) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="priceStep"
                        type="number"
                        min="1"
                        step="0.01"
                        value={priceStep}
                        onChange={(e) => setPriceStep(e.target.value)}
                        placeholder="10.00"
                        className="pl-7"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The minimum amount by which bids must increase
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(-1)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Auction
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {selectedProduct && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Selected Product</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-square rounded-lg bg-muted overflow-hidden">
                    {getImageUrl(selectedProduct.image_url) ? (
                      <img
                        src={getImageUrl(selectedProduct.image_url)!}
                        alt={selectedProduct.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gavel className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedProduct.product_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedProduct.product_type}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {selectedProduct.product_description}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
