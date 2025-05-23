
// src/components/admin/CarTypeManager.tsx
'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { CarTypeOptionAdmin } from '@/types/admin';
import { addCarTypeAdmin, updateCarTypeAdmin, deleteCarTypeAdmin } from '@/services/adminService';
import { useRouter } from 'next/navigation';
import { Trash2, Edit, PlusCircle, UploadCloud, XCircle } from 'lucide-react';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Schema for form data handling FileList or existing string URL
const carTypeFormSchema = z.object({
  label: z.string().min(1, 'اسم النوع (بالعربية) مطلوب').max(100, 'الاسم طويل جداً'),
  imageUrlInput: z.any().optional(), // Changed from z.instanceof(FileList)
  existingImageUrl: z.string().url().optional().or(z.literal('')), // For displaying/keeping existing image
  existingPublicId: z.string().optional().or(z.literal('')), // For Cloudinary public_id
  order: z.coerce.number().min(0, 'الترتيب يجب أن يكون 0 أو أكبر'),
}).refine(data => {
  // FileList is a browser API, check for its existence before using instanceof
  const hasNewFile = typeof FileList !== 'undefined' && data.imageUrlInput instanceof FileList && data.imageUrlInput.length > 0;
  const hasExistingImage = !!data.existingImageUrl;
  return hasNewFile || hasExistingImage;
}, {
  message: "الرجاء اختيار صورة جديدة أو التأكد من وجود صورة حالية.",
  path: ["imageUrlInput"], 
});


type CarTypeFormData = z.infer<typeof carTypeFormSchema>;

interface CarTypeManagerProps {
  initialCarTypes: CarTypeOptionAdmin[];
}

export function CarTypeManager({ initialCarTypes }: CarTypeManagerProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingCarType, setEditingCarType] = useState<CarTypeOptionAdmin | null>(null);
  const [carTypes, setCarTypes] = useState<CarTypeOptionAdmin[]>(initialCarTypes);
  const [showForm, setShowForm] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);


  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isDirty } } = useForm<CarTypeFormData>({
    resolver: zodResolver(carTypeFormSchema),
    defaultValues: {
      label: '',
      existingImageUrl: '',
      existingPublicId: '',
      order: 0,
      imageUrlInput: undefined,
    },
  });

  const watchedImageUrlInput = watch('imageUrlInput');
  const watchedExistingImageUrl = watch('existingImageUrl');
  
  const { ref: imageInputRegisterRef, ...imageInputProps } = register('imageUrlInput');


  useEffect(() => {
    if (watchedImageUrlInput && watchedImageUrlInput.length > 0 && watchedImageUrlInput[0] instanceof File) {
      const file = watchedImageUrlInput[0];
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
      return () => URL.revokeObjectURL(previewUrl); 
    } else if (watchedExistingImageUrl) {
      setImagePreviewUrl(watchedExistingImageUrl);
    } else {
      setImagePreviewUrl(null);
    }
  }, [watchedImageUrlInput, watchedExistingImageUrl]);


  const handleEdit = (carType: CarTypeOptionAdmin) => {
    setEditingCarType(carType);
    setValue('label', carType.label);
    setValue('existingImageUrl', carType.imageUrl || '');
    setValue('existingPublicId', carType.publicId || '');
    setValue('imageUrlInput', undefined); 
    setValue('order', carType.order);
    setShowForm(true);
    setImagePreviewUrl(carType.imageUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear file input
    }
  };
  
  const handleClearImage = () => {
    setValue('imageUrlInput', undefined); // Clear the FileList
    setValue('existingImageUrl', ''); 
    setValue('existingPublicId', '');
    if(fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
    setImagePreviewUrl(null);
  };

  const resetFormAndState = () => {
    const defaultOrder = carTypes.length > 0 ? Math.max(...carTypes.map(ct => ct.order)) + 1 : 0;
    reset({
      label: '',
      imageUrlInput: undefined,
      existingImageUrl: '',
      existingPublicId: '',
      order: defaultOrder,
    });
    setEditingCarType(null);
    setShowForm(false);
    setImagePreviewUrl(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const onSubmit: SubmitHandler<CarTypeFormData> = async (data) => {
    startTransition(async () => {
      try {
        const imageFile = data.imageUrlInput && data.imageUrlInput.length > 0 && data.imageUrlInput[0] instanceof File ? data.imageUrlInput[0] : null;

        if (editingCarType) {
          // For updates, imageFile can be null if user doesn't change it
          if (!imageFile && !data.existingImageUrl) {
             toast({ title: 'خطأ في الصورة', description: 'يجب توفير صورة للمتابعة أو الإبقاء على الصورة الحالية.', variant: 'destructive' });
             return;
          }
          await updateCarTypeAdmin(editingCarType.id!, { 
            label: data.label,
            order: data.order,
            imageUrlInput: imageFile, // Pass the file or null
            currentImageUrl: editingCarType.imageUrl, 
            currentPublicId: editingCarType.publicId,
          });
          toast({ title: 'تم التحديث', description: `تم تحديث نوع السيارة: ${data.label}` });
        } else {
           // For adds, imageFile must exist
           if (!imageFile) {
            toast({ title: 'خطأ في الصورة', description: 'الرجاء اختيار ملف صورة لإضافته.', variant: 'destructive' });
            return;
          }
          await addCarTypeAdmin({
            label: data.label,
            order: data.order,
            imageUrlInput: imageFile, // Must be a file for add
          });
          toast({ title: 'تمت الإضافة', description: `تمت إضافة نوع السيارة: ${data.label}` });
        }
        resetFormAndState();
        router.refresh();
      } catch (error) {
        console.error('Failed to save car type:', error);
        toast({
          title: 'خطأ في الحفظ',
          description: (error instanceof Error ? error.message : 'فشل حفظ نوع السيارة.'),
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = (carType: CarTypeOptionAdmin) => {
    startTransition(async () => {
      try {
        await deleteCarTypeAdmin(carType.id!); 
        toast({ title: 'تم الحذف', description: `تم حذف نوع السيارة: ${carType.label}` });
        router.refresh();
      } catch (error) {
        console.error('Failed to delete car type:', error);
        toast({
          title: 'خطأ في الحذف',
          description: (error instanceof Error ? error.message : 'فشل حذف نوع السيارة.'),
          variant: 'destructive',
        });
      }
    });
  };
  
  useEffect(() => {
    setCarTypes(initialCarTypes);
     if (!editingCarType && !showForm) { 
        const defaultOrder = initialCarTypes.length > 0 ? Math.max(...initialCarTypes.map(ct => ct.order)) + 1 : 0;
        reset({ 
            label: '', 
            imageUrlInput: undefined,
            existingImageUrl: '',
            existingPublicId: '',
            order: defaultOrder 
        });
    }
  }, [initialCarTypes, reset, editingCarType, showForm]);


  return (
    <div className="space-y-6">
      <Button onClick={() => { 
          setShowForm(true); 
          setEditingCarType(null); 
          const defaultOrder = carTypes.length > 0 ? Math.max(...carTypes.map(ct => ct.order)) + 1 : 0;
          reset({ 
              label: '', 
              imageUrlInput: undefined,
              existingImageUrl: '', 
              existingPublicId: '',
              order: defaultOrder 
          });
          setImagePreviewUrl(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Clear file input
          }
      }} className="mb-4 bg-accent hover:bg-accent/90 text-accent-foreground">
        <PlusCircle className="ml-2 h-4 w-4" /> إضافة نوع سيارة جديد
      </Button>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 admin-form p-4 glass-card mb-6">
          <h3 className="text-lg font-medium">{editingCarType ? 'تعديل نوع السيارة' : 'إضافة نوع سيارة جديد'}</h3>
          <div>
            <Label htmlFor="ct-label">الاسم (بالعربية)</Label>
            <Input id="ct-label" {...register('label')} />
            {errors.label && <p className="text-sm text-destructive mt-1">{errors.label.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="ct-imageUrlInput">صورة النوع</Label>
            <div className="flex items-center gap-4">
                {imagePreviewUrl && (
                    <div className="relative w-24 h-16 rounded border border-muted overflow-hidden">
                        <Image src={imagePreviewUrl} alt="معاينة الصورة" layout="fill" objectFit="cover" />
                    </div>
                )}
                {!imagePreviewUrl && (
                    <div className="w-24 h-16 rounded border border-dashed border-muted flex items-center justify-center bg-muted/20">
                        <UploadCloud className="w-8 h-8 text-muted-foreground" />
                    </div>
                )}
                <Input 
                    id="ct-imageUrlInput" 
                    type="file" 
                    accept="image/*" 
                    {...imageInputProps} 
                    ref={(e) => { 
                        imageInputRegisterRef(e); 
                        fileInputRef.current = e; 
                    }}
                    className="flex-grow"
                />
                {(imagePreviewUrl || (watchedImageUrlInput && watchedImageUrlInput.length > 0)) && (
                     <Button type="button" variant="ghost" size="sm" onClick={handleClearImage} aria-label="مسح الصورة">
                        <XCircle className="w-5 h-5 text-destructive"/>
                    </Button>
                )}
            </div>
            <input type="hidden" {...register('existingImageUrl')} />
            <input type="hidden" {...register('existingPublicId')} />
            {errors.imageUrlInput && <p className="text-sm text-destructive mt-1">{errors.imageUrlInput.message}</p>}
             {editingCarType && !imagePreviewUrl && !(watchedImageUrlInput && watchedImageUrlInput.length > 0) && (
              <p className="text-xs text-muted-foreground mt-1">اترك حقل الملف فارغًا للاحتفاظ بالصورة الحالية: {editingCarType.label}.</p>
            )}
          </div>

          <div>
            <Label htmlFor="ct-order">ترتيب العرض</Label>
            <Input id="ct-order" type="number" {...register('order')} />
            {errors.order && <p className="text-sm text-destructive mt-1">{errors.order.message}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || !isDirty} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {isPending ? 'جاري الحفظ...' : (editingCarType ? 'حفظ التعديلات' : 'إضافة النوع')}
            </Button>
            <Button type="button" variant="outline" onClick={resetFormAndState} disabled={isPending}>
              إلغاء
            </Button>
          </div>
        </form>
      )}

      <div className="admin-item-list">
        {carTypes.length === 0 && !showForm && <p>لا توجد أنواع سيارات معرفة حالياً.</p>}
        {carTypes.map((carType) => (
          <div key={carType.id} className="admin-item">
            <div className="flex items-center gap-4">
              {carType.imageUrl ? (
                <Image src={carType.imageUrl} alt={carType.label} width={60} height={40} className="rounded object-cover" data-ai-hint={"car image"}/>
              ) : (
                <div className="w-[60px] h-[40px] rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">لا توجد صورة</div>
              )}
              <div>
                <p className="font-semibold">{carType.label} <span className="text-xs text-muted-foreground">({carType.value})</span></p>
                <p className="text-xs text-muted-foreground">الترتيب: {carType.order}</p>
              </div>
            </div>
            <div className="admin-item-actions">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(carType)} aria-label="تعديل">
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive" aria-label="حذف">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد?</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم حذف نوع السيارة "{carType.label}" وجميع موديلات السيارات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(carType)}
                      disabled={isPending}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      {isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
