'use client';

import { useMutation } from 'convex/react';
import { Check, Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useSession } from '@/components/providers/SessionProvider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTenantMutation, useTenantQuery } from '@/hooks/useTenantQuery';

import { api } from '../../../../../convex/_generated/api';
import { Doc, Id } from '../../../../../convex/_generated/dataModel';

type PricingPlan = Doc<'pricingPlans'>;

type FormData = {
  name: string;
  badge: string;
  originalPrice: string;
  price: string;
  installments: string;
  installmentDetails: string;
  description: string;
  features: string;
  buttonText: string;
  productId: string;
  category: 'year_access' | 'premium_pack' | 'addon' | '';
  year: string;
  regularPriceNum: string;
  pixPriceNum: string;
  accessYears: string;
  isActive: boolean;
  displayOrder: string;
};

export default function PricingPlansAdminPage() {
  const router = useRouter();
  const { isAdmin, isLoading: sessionLoading } = useSession();

  // Redirect non-super-admins
  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      router.push('/admin');
    }
  }, [sessionLoading, isAdmin, router]);

  const plans = useTenantQuery(api.pricingPlans.getPricingPlans, {}) || [];
  const savePlan = useTenantMutation(api.pricingPlans.savePricingPlan);
  const removePlan = useMutation(api.pricingPlans.removePricingPlan);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FormData>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FormData>({
    name: '',
    badge: '',
    originalPrice: '',
    price: '',
    installments: '',
    installmentDetails: '',
    description: '',
    features: '',
    buttonText: '',
    productId: '',
    category: '',
    year: '',
    regularPriceNum: '',
    pixPriceNum: '',
    accessYears: '',
    isActive: true,
    displayOrder: '',
  });

  function startEdit(plan: PricingPlan) {
    setEditingId(plan._id);
    setEditForm({
      name: plan.name,
      badge: plan.badge,
      originalPrice: plan.originalPrice,
      price: plan.price,
      installments: plan.installments,
      installmentDetails: plan.installmentDetails,
      description: plan.description,
      features: plan.features.join('\n'),
      buttonText: plan.buttonText,
      productId: plan.productId,
      category: plan.category || '',
      year: plan.year?.toString() || '',
      regularPriceNum: plan.regularPriceNum?.toString() || '',
      pixPriceNum: plan.pixPriceNum?.toString() || '',
      accessYears: plan.accessYears?.join(',') || '',
      isActive: plan.isActive ?? true,
      displayOrder: plan.displayOrder?.toString() || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  function processFormData(formData: FormData | Partial<FormData>) {
    const features = (formData.features || '')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const year = formData.year ? Number.parseInt(formData.year, 10) : undefined;
    const regularPriceNum = formData.regularPriceNum
      ? Number.parseFloat(formData.regularPriceNum)
      : undefined;
    const pixPriceNum = formData.pixPriceNum
      ? Number.parseFloat(formData.pixPriceNum)
      : undefined;
    const accessYears = formData.accessYears
      ? formData.accessYears
          .split(',')
          .map(y => Number.parseInt(y.trim(), 10))
          .filter(y => !Number.isNaN(y))
      : undefined;
    const displayOrder = formData.displayOrder
      ? Number.parseInt(formData.displayOrder, 10)
      : undefined;

    // Handle category - only include if it's a valid value (empty string is falsy, so just check truthiness)
    const category = formData.category
      ? (formData.category as 'year_access' | 'premium_pack' | 'addon')
      : undefined;

    return {
      name: formData.name?.trim() || '',
      badge: formData.badge?.trim() || '',
      originalPrice: formData.originalPrice?.trim() || undefined,
      price: formData.price?.trim() || '',
      installments: formData.installments?.trim() || '',
      installmentDetails: formData.installmentDetails?.trim() || '',
      description: formData.description?.trim() || '',
      features,
      buttonText: formData.buttonText?.trim() || '',
      productId: formData.productId?.trim() || '',
      category,
      year,
      regularPriceNum,
      pixPriceNum,
      accessYears,
      isActive: formData.isActive,
      displayOrder,
    };
  }

  async function handleSavePlan(isEdit: boolean = false) {
    if (isEdit) {
      if (
        !editingId ||
        !editForm.name?.trim() ||
        !editForm.price?.trim() ||
        !editForm.productId?.trim()
      )
        return;

      const planData = processFormData(editForm as FormData);
      await savePlan({
        id: editingId as Id<'pricingPlans'>,
        ...planData,
      });

      cancelEdit();
    } else {
      if (
        !createForm.name.trim() ||
        !createForm.price.trim() ||
        !createForm.productId.trim()
      )
        return;

      const planData = processFormData(createForm);
      await savePlan(planData);

      setCreateForm({
        name: '',
        badge: '',
        originalPrice: '',
        price: '',
        installments: '',
        installmentDetails: '',
        description: '',
        features: '',
        buttonText: '',
        productId: '',
        category: '',
        year: '',
        regularPriceNum: '',
        pixPriceNum: '',
        accessYears: '',
        isActive: true,
        displayOrder: '',
      });
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir plano de preços?')) return;
    await removePlan({ id: id as Id<'pricingPlans'> });
  }

  // Show loading while checking permissions
  if (sessionLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render if not admin (will redirect)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6 p-0 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planos de Preços</h1>
        <Button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <div className="to-brand-blue/10 rounded-2xl bg-gradient-to-br from-slate-50 py-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 md:grid-cols-2 xl:grid-cols-3">
          {isCreating && (
            <div className="border-brand-blue/30 relative w-full overflow-hidden rounded-2xl border-2 border-dashed bg-white shadow-xl">
              <div className="max-h-[80vh] space-y-6 overflow-y-auto p-6">
                {/* Internal/Admin Fields Section */}
                <div className="space-y-3">
                  <h3 className="border-b pb-2 text-sm font-semibold text-gray-900">
                    🔒 Campos Internos (não visíveis na landing page)
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Product ID *
                      </Label>
                      <Input
                        value={createForm.productId}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            productId: e.target.value,
                          }))
                        }
                        placeholder="Ex: ortoqbank_2025"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">
                        Identificador único do produto
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Categoria</Label>
                      <Select
                        value={createForm.category}
                        onValueChange={value =>
                          setCreateForm(f => ({ ...f, category: value as any }))
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Selecione categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="year_access">
                            Acesso Anual
                          </SelectItem>
                          <SelectItem value="premium_pack">
                            Pacote Premium
                          </SelectItem>
                          <SelectItem value="addon">Add-on</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Ano</Label>
                      <Input
                        type="number"
                        value={createForm.year}
                        onChange={e =>
                          setCreateForm(f => ({ ...f, year: e.target.value }))
                        }
                        placeholder="Ex: 2025"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Preço Regular (número)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={createForm.regularPriceNum}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            regularPriceNum: e.target.value,
                          }))
                        }
                        placeholder="Ex: 299.00"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">
                        Para cálculos (cartão de crédito)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Preço PIX (número)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={createForm.pixPriceNum}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            pixPriceNum: e.target.value,
                          }))
                        }
                        placeholder="Ex: 269.10"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">
                        Preço com desconto PIX (10%)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Anos de Acesso
                      </Label>
                      <Input
                        value={createForm.accessYears}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            accessYears: e.target.value,
                          }))
                        }
                        placeholder="Ex: 2026,2027"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">
                        Anos que o usuário terá acesso (separados por vírgula)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Ordem de Exibição
                      </Label>
                      <Input
                        type="number"
                        value={createForm.displayOrder}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            displayOrder: e.target.value,
                          }))
                        }
                        placeholder="Ex: 1"
                        className="text-xs"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isActive-create"
                        checked={createForm.isActive}
                        onCheckedChange={checked =>
                          setCreateForm(f => ({
                            ...f,
                            isActive: checked as boolean,
                          }))
                        }
                      />
                      <Label
                        htmlFor="isActive-create"
                        className="cursor-pointer text-xs font-medium"
                      >
                        Plano Ativo (visível para compra)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Display Fields Section */}
                <div className="space-y-3">
                  <h3 className="border-b pb-2 text-sm font-semibold text-gray-900">
                    👁️ Campos de Exibição (visíveis na landing page)
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Badge</Label>
                      <Input
                        value={createForm.badge}
                        onChange={e =>
                          setCreateForm(f => ({ ...f, badge: e.target.value }))
                        }
                        placeholder="Ex: Mais Popular"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Nome do Plano *
                      </Label>
                      <Input
                        value={createForm.name}
                        onChange={e =>
                          setCreateForm(f => ({ ...f, name: e.target.value }))
                        }
                        placeholder="Nome do plano"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Preço Original (texto)
                      </Label>
                      <Input
                        value={createForm.originalPrice}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            originalPrice: e.target.value,
                          }))
                        }
                        placeholder="Ex: R$ 299"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">
                        Preço riscado (marketing)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Preço Atual (texto) *
                      </Label>
                      <Input
                        value={createForm.price}
                        onChange={e =>
                          setCreateForm(f => ({ ...f, price: e.target.value }))
                        }
                        placeholder="Ex: R$ 199"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">
                        Preço exibido em destaque
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Parcelas</Label>
                      <Input
                        value={createForm.installments}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            installments: e.target.value,
                          }))
                        }
                        placeholder="Ex: 12x de R$ 16,58"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Detalhes das Parcelas
                      </Label>
                      <Input
                        value={createForm.installmentDetails}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            installmentDetails: e.target.value,
                          }))
                        }
                        placeholder="Ex: sem juros"
                        className="text-xs"
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs font-medium">Descrição</Label>
                      <Input
                        value={createForm.description}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Descrição do plano"
                        className="text-xs"
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs font-medium">
                        Recursos (um por linha)
                      </Label>
                      <Textarea
                        value={createForm.features}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            features: e.target.value,
                          }))
                        }
                        placeholder="Acesso completo&#10;Suporte 24/7"
                        rows={4}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Texto do Botão
                      </Label>
                      <Input
                        value={createForm.buttonText}
                        onChange={e =>
                          setCreateForm(f => ({
                            ...f,
                            buttonText: e.target.value,
                          }))
                        }
                        placeholder="Ex: Começar Agora"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t pt-4">
                  <Button
                    onClick={() => handleSavePlan(false)}
                    size="sm"
                    className="flex-1"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Criar Plano
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreating(false)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {plans?.map(plan => (
            <div
              key={plan._id}
              className="relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            >
              {editingId === plan._id ? (
                <div className="max-h-[80vh] space-y-6 overflow-y-auto p-6">
                  {/* Internal/Admin Fields Section */}
                  <div className="space-y-3">
                    <h3 className="border-b pb-2 text-sm font-semibold text-gray-900">
                      🔒 Campos Internos
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Product ID *
                        </Label>
                        <Input
                          value={editForm.productId || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              productId: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Categoria</Label>
                        <Select
                          value={editForm.category || ''}
                          onValueChange={value =>
                            setEditForm(f => ({ ...f, category: value as any }))
                          }
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Selecione categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="year_access">
                              Acesso Anual
                            </SelectItem>
                            <SelectItem value="premium_pack">
                              Pacote Premium
                            </SelectItem>
                            <SelectItem value="addon">Add-on</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Ano</Label>
                        <Input
                          type="number"
                          value={editForm.year || ''}
                          onChange={e =>
                            setEditForm(f => ({ ...f, year: e.target.value }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Preço Regular (número)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.regularPriceNum || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              regularPriceNum: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Preço PIX (número)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.pixPriceNum || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              pixPriceNum: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Anos de Acesso
                        </Label>
                        <Input
                          value={editForm.accessYears || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              accessYears: e.target.value,
                            }))
                          }
                          placeholder="Ex: 2026,2027"
                          className="text-xs"
                        />
                        <p className="text-xs text-gray-500">
                          Anos separados por vírgula
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Ordem de Exibição
                        </Label>
                        <Input
                          type="number"
                          value={editForm.displayOrder || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              displayOrder: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`isActive-edit-${plan._id}`}
                          checked={editForm.isActive ?? true}
                          onCheckedChange={checked =>
                            setEditForm(f => ({
                              ...f,
                              isActive: checked as boolean,
                            }))
                          }
                        />
                        <Label
                          htmlFor={`isActive-edit-${plan._id}`}
                          className="cursor-pointer text-xs font-medium"
                        >
                          Plano Ativo
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Display Fields Section */}
                  <div className="space-y-3">
                    <h3 className="border-b pb-2 text-sm font-semibold text-gray-900">
                      👁️ Campos de Exibição
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Badge</Label>
                        <Input
                          value={editForm.badge || ''}
                          onChange={e =>
                            setEditForm(f => ({ ...f, badge: e.target.value }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Nome do Plano *
                        </Label>
                        <Input
                          value={editForm.name || ''}
                          onChange={e =>
                            setEditForm(f => ({ ...f, name: e.target.value }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Preço Original (texto)
                        </Label>
                        <Input
                          value={editForm.originalPrice || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              originalPrice: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Preço Atual (texto) *
                        </Label>
                        <Input
                          value={editForm.price || ''}
                          onChange={e =>
                            setEditForm(f => ({ ...f, price: e.target.value }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Parcelas</Label>
                        <Input
                          value={editForm.installments || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              installments: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Detalhes das Parcelas
                        </Label>
                        <Input
                          value={editForm.installmentDetails || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              installmentDetails: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs font-medium">Descrição</Label>
                        <Input
                          value={editForm.description || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs font-medium">
                          Recursos (um por linha)
                        </Label>
                        <Textarea
                          value={editForm.features || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              features: e.target.value,
                            }))
                          }
                          rows={4}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Texto do Botão
                        </Label>
                        <Input
                          value={editForm.buttonText || ''}
                          onChange={e =>
                            setEditForm(f => ({
                              ...f,
                              buttonText: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t pt-4">
                    <Button
                      onClick={() => handleSavePlan(true)}
                      size="sm"
                      className="flex-1"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(plan)}
                      className="h-8 w-8 bg-white/80 p-0 hover:bg-white"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(plan._id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Internal Info Banner */}
                  <div className="border-b bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <div className="font-mono text-gray-600">
                          <span className="font-semibold">ID:</span>{' '}
                          {plan.productId}
                        </div>
                        {plan.category && (
                          <div className="text-gray-500">
                            <span className="font-semibold">Categoria:</span>{' '}
                            {plan.category === 'year_access'
                              ? 'Acesso Anual'
                              : plan.category === 'premium_pack'
                                ? 'Pacote Premium'
                                : 'Add-on'}
                            {plan.year && ` • ${plan.year}`}
                          </div>
                        )}
                        {(plan.regularPriceNum || plan.pixPriceNum) && (
                          <div className="text-gray-500">
                            {plan.regularPriceNum && (
                              <span>
                                💳 R$ {plan.regularPriceNum.toFixed(2)}
                              </span>
                            )}
                            {plan.pixPriceNum && (
                              <span className="ml-2">
                                <strong>PIX</strong> R${' '}
                                {plan.pixPriceNum.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            plan.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {plan.isActive ? '✓ Ativo' : '✗ Inativo'}
                        </span>
                        {plan.accessYears && plan.accessYears.length > 0 && (
                          <span className="text-gray-500">
                            📅 Anos: {plan.accessYears.join(', ')}
                          </span>
                        )}
                        {plan.displayOrder !== undefined && (
                          <span className="text-xs text-gray-400">
                            Ordem: {plan.displayOrder}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer-Facing Display */}
                  <div className="py-4 text-center">
                    <div className="bg-brand-blue/10 text-brand-blue inline-block rounded-full px-4 py-1 text-xs font-bold">
                      {plan.badge}
                    </div>
                  </div>

                  <div className="px-6 pb-6 text-center">
                    <div className="flex h-20 flex-col justify-center">
                      <div className="mb-2 min-h-[1.5em] text-lg text-red-500 line-through">
                        {plan.originalPrice && (
                          <span>{plan.originalPrice}</span>
                        )}
                      </div>
                      <div className="mb-2 text-4xl font-bold text-gray-900">
                        {plan.price}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {plan.installments}
                    </div>
                  </div>

                  <div className="px-6 pb-6">
                    <p className="text-center text-sm text-gray-600">
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex-grow px-6">
                    <ul className="space-y-3">
                      {plan.features.map(
                        (feature: string, featureIndex: number) => (
                          <li
                            key={featureIndex}
                            className="flex items-center gap-3"
                          >
                            <div className="bg-brand-blue/10 flex h-5 w-5 items-center justify-center rounded-full">
                              <Check className="text-brand-blue h-3 w-3" />
                            </div>
                            <span className="text-sm text-gray-700">
                              {feature}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div className="flex-shrink-0 p-6">
                    <div
                      className={`w-full rounded-xl px-6 py-3 text-center text-sm font-semibold ${
                        plan.isActive
                          ? 'bg-brand-blue text-white'
                          : 'bg-gray-300 text-gray-600'
                      } shadow-lg`}
                    >
                      {plan.buttonText}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
