import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, ArrowLeft, Image as ImageIcon, AlertCircle, UploadCloud } from 'lucide-react';

const productTypes = [
  'Electronics', 'Art & Collectibles', 'Fashion', 'Jewelry', 'Watches',
  'Vehicles', 'Real Estate', 'Antiques', 'Sports & Outdoors',
  'Home & Garden', 'Books & Media', 'Toys & Games', 'Musical Instruments', 'Other',
];

interface ProductFormData {
  productName: string;
  productDescription: string;
  productType: string;
  imageUrl: string | null;      
  additionalImages: string[];   
}

export default function NewProduct() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State lưu file thực tế để upload
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ProductFormData>({
    productName: '',
    productDescription: '',
    productType: '',
    imageUrl: null, 
    additionalImages: [],
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, productType: value }));
    if (errors.productType) setErrors({ ...errors, productType: '' });
  };

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    setMainFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, imageUrl: previewUrl }));

    if (errors.imageUrl) setErrors({ ...errors, imageUrl: '' });
  };

  const removeMainImage = () => {
    setMainFile(null);
    setFormData(prev => ({ ...prev, imageUrl: null }));
  };

  const handleAdditionalImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (additionalFiles.length + validFiles.length > 5) {
      toast({ title: 'Limit exceeded', description: 'Max 5 additional images allowed', variant: 'destructive' });
      return;
    }

    setAdditionalFiles(prev => [...prev, ...validFiles]);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setFormData(prev => ({
      ...prev,
      additionalImages: [...prev.additionalImages, ...newPreviews]
    }));
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      additionalImages: prev.additionalImages.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.productName.trim()) newErrors.productName = 'Product name is required';
    if (!formData.productDescription.trim()) newErrors.productDescription = 'Description is required';
    if (!formData.productType) newErrors.productType = 'Product type is required';
    if (!formData.imageUrl) newErrors.imageUrl = 'Main product image is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      
      formDataToSend.append('product_name', formData.productName);
      formDataToSend.append('product_description', formData.productDescription);
      formDataToSend.append('product_type', formData.productType);

      if (mainFile) {
        formDataToSend.append('main_image', mainFile);
      }

      additionalFiles.forEach((file) => {
        formDataToSend.append('additional_images', file);
      });

      // Gọi API
      await apiClient.products.createWithImages(formDataToSend);

      toast({ title: 'Success', description: 'Product submitted successfully!' });
      navigate('/dashboard/products');
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Submission failed',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-3xl font-bold">Add New Product</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>Basic information about your item.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  name="productName"
                  value={formData.productName}
                  onChange={handleInputChange}
                  className={errors.productName ? 'border-destructive' : ''}
                />
                {errors.productName && <p className="text-sm text-destructive">{errors.productName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productType">Category *</Label>
                <Select value={formData.productType} onValueChange={handleSelectChange}>
                  <SelectTrigger className={errors.productType ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.productType && <p className="text-sm text-destructive">{errors.productType}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productDescription">Description *</Label>
                <Textarea
                  id="productDescription"
                  name="productDescription"
                  rows={5}
                  value={formData.productDescription}
                  onChange={handleInputChange}
                  className={errors.productDescription ? 'border-destructive' : ''}
                />
                {errors.productDescription && <p className="text-sm text-destructive">{errors.productDescription}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Images</CardTitle>
              <CardDescription>Add up to 5 more photos (Optional).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {formData.additionalImages.map((previewUrl, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                    <img src={previewUrl} alt="Additional" className="w-full h-full object-cover" />
                    <Button
                      type="button" variant="destructive" size="icon"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => removeAdditionalImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                
                {formData.additionalImages.length < 5 && (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-md aspect-square cursor-pointer hover:bg-muted/50 transition-colors">
                    <UploadCloud className="h-6 w-6 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">Add Image</span>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleAdditionalImagesChange} />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={errors.imageUrl ? 'border-destructive' : ''}>
            <CardHeader>
              <CardTitle>Main Image *</CardTitle>
              <CardDescription>The primary photo for your listing.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formData.imageUrl ? (
                  <div className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={formData.imageUrl} alt="Main" className="w-full h-full object-cover" />
                    <Button
                      type="button" variant="destructive" size="icon"
                      className="absolute top-2 right-2"
                      onClick={removeMainImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg aspect-square cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20">
                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                      <ImageIcon className="h-8 w-8 text-primary" />
                    </div>
                    <p className="font-medium text-sm">Upload Main Image</p>
                    <p className="text-xs text-muted-foreground mt-1">Required</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleMainImageChange} />
                  </label>
                )}
                {errors.imageUrl && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.imageUrl}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full" size="lg">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Product'}
          </Button>
          
          <Button variant="outline" className="w-full" asChild>
            <Link to="/dashboard/products">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}