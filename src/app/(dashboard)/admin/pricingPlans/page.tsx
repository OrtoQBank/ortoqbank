'use client';

import { useMutation, useQuery } from 'convex/react';
import { Check, Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  accessDurationDays: string;
  isActive: boolean;
  displayOrder: string;
};

export default function PricingPlansAdminPage() {
  const plans = useQuery(api.pricingPlans.getPricingPlans) || [];
  const savePlan = useMutation(api.pricingPlans.savePricingPlan);
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
    accessDurationDays: '',
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
      accessDurationDays: plan.accessDurationDays?.toString() || '',
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

    const year = formData.year ? parseInt(formData.year) : undefined;
    const regularPriceNum = formData.regularPriceNum ? parseFloat(formData.regularPriceNum) : undefined;
    const pixPriceNum = formData.pixPriceNum ? parseFloat(formData.pixPriceNum) : undefined;
    const accessDurationDays = formData.accessDurationDays ? parseInt(formData.accessDurationDays) : undefined;
    const displayOrder = formData.displayOrder ? parseInt(formData.displayOrder) : undefined;

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
      accessDurationDays,
      isActive: formData.isActive,
      displayOrder,
    };
  }

  async function handleSavePlan(isEdit: boolean = false) {
    if (isEdit) {
      if (!editingId || !editForm.name?.trim() || !editForm.price?.trim() || !editForm.productId?.trim()) return;
      
      const planData = processFormData(editForm as FormData);
      await savePlan({
        id: editingId as Id<'pricingPlans'>,
        ...planData,
      });
      
      cancelEdit();
    } else {
      if (!createForm.name.trim() || !createForm.price.trim() || !createForm.productId.trim()) return;
      
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
        accessDurationDays: '',
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

  return (
    <div className="space-y-6 p-0 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planos de Preços</h1>
        <Button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Plano
        </Button>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-blue-50 py-8 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto px-4">
          {isCreating && (
            <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden w-full border-2 border-dashed border-blue-300">
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Internal/Admin Fields Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">🔒 Campos Internos (não visíveis na landing page)</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Product ID *</Label>
                      <Input
                        value={createForm.productId}
                        onChange={e => setCreateForm(f => ({ ...f, productId: e.target.value }))}
                        placeholder="Ex: ortoqbank_2025"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">Identificador único do produto</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Categoria</Label>
                      <Select
                        value={createForm.category}
                        onValueChange={(value) => setCreateForm(f => ({ ...f, category: value as any }))}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Selecione categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="year_access">Acesso Anual</SelectItem>
                          <SelectItem value="premium_pack">Pacote Premium</SelectItem>
                          <SelectItem value="addon">Add-on</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Ano</Label>
                      <Input
                        type="number"
                        value={createForm.year}
                        onChange={e => setCreateForm(f => ({ ...f, year: e.target.value }))}
                        placeholder="Ex: 2025"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Preço Regular (número)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={createForm.regularPriceNum}
                        onChange={e => setCreateForm(f => ({ ...f, regularPriceNum: e.target.value }))}
                        placeholder="Ex: 299.00"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">Para cálculos (cartão de crédito)</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Preço PIX (número)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={createForm.pixPriceNum}
                        onChange={e => setCreateForm(f => ({ ...f, pixPriceNum: e.target.value }))}
                        placeholder="Ex: 269.10"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">Preço com desconto PIX (10%)</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Duração do Acesso (dias)</Label>
                      <Input
                        type="number"
                        value={createForm.accessDurationDays}
                        onChange={e => setCreateForm(f => ({ ...f, accessDurationDays: e.target.value }))}
                        placeholder="Ex: 365"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">Deixe vazio para acesso permanente</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Ordem de Exibição</Label>
                      <Input
                        type="number"
                        value={createForm.displayOrder}
                        onChange={e => setCreateForm(f => ({ ...f, displayOrder: e.target.value }))}
                        placeholder="Ex: 1"
                        className="text-xs"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isActive-create"
                        checked={createForm.isActive}
                        onCheckedChange={(checked) => setCreateForm(f => ({ ...f, isActive: checked as boolean }))}
                      />
                      <Label htmlFor="isActive-create" className="text-xs font-medium cursor-pointer">
                        Plano Ativo (visível para compra)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Display Fields Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">👁️ Campos de Exibição (visíveis na landing page)</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Badge</Label>
                      <Input
                        value={createForm.badge}
                        onChange={e => setCreateForm(f => ({ ...f, badge: e.target.value }))}
                        placeholder="Ex: Mais Popular"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Nome do Plano *</Label>
                      <Input
                        value={createForm.name}
                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nome do plano"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Preço Original (texto)</Label>
                      <Input
                        value={createForm.originalPrice}
                        onChange={e => setCreateForm(f => ({ ...f, originalPrice: e.target.value }))}
                        placeholder="Ex: R$ 299"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">Preço riscado (marketing)</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Preço Atual (texto) *</Label>
                      <Input
                        value={createForm.price}
                        onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="Ex: R$ 199"
                        className="text-xs"
                      />
                      <p className="text-xs text-gray-500">Preço exibido em destaque</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Parcelas</Label>
                      <Input
                        value={createForm.installments}
                        onChange={e => setCreateForm(f => ({ ...f, installments: e.target.value }))}
                        placeholder="Ex: 12x de R$ 16,58"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Detalhes das Parcelas</Label>
                      <Input
                        value={createForm.installmentDetails}
                        onChange={e => setCreateForm(f => ({ ...f, installmentDetails: e.target.value }))}
                        placeholder="Ex: sem juros"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs font-medium">Descrição</Label>
                      <Input
                        value={createForm.description}
                        onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Descrição do plano"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs font-medium">Recursos (um por linha)</Label>
                      <Textarea
                        value={createForm.features}
                        onChange={e => setCreateForm(f => ({ ...f, features: e.target.value }))}
                        placeholder="Acesso completo&#10;Suporte 24/7"
                        rows={4}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Texto do Botão</Label>
                      <Input
                        value={createForm.buttonText}
                        onChange={e => setCreateForm(f => ({ ...f, buttonText: e.target.value }))}
                        placeholder="Ex: Começar Agora"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => handleSavePlan(false)} size="sm" className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    Criar Plano
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreating(false)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {plans?.map((plan) => (
            <div
              key={plan._id}
              className="relative bg-white rounded-2xl shadow-xl overflow-hidden w-full flex flex-col"
            >
              {editingId === plan._id ? (
                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                  {/* Internal/Admin Fields Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">🔒 Campos Internos</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Product ID *</Label>
                        <Input
                          value={editForm.productId || ''}
                          onChange={e => setEditForm(f => ({ ...f, productId: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Categoria</Label>
                        <Select
                          value={editForm.category || ''}
                          onValueChange={(value) => setEditForm(f => ({ ...f, category: value as any }))}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Selecione categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="year_access">Acesso Anual</SelectItem>
                            <SelectItem value="premium_pack">Pacote Premium</SelectItem>
                            <SelectItem value="addon">Add-on</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Ano</Label>
                        <Input
                          type="number"
                          value={editForm.year || ''}
                          onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Preço Regular (número)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.regularPriceNum || ''}
                          onChange={e => setEditForm(f => ({ ...f, regularPriceNum: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Preço PIX (número)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.pixPriceNum || ''}
                          onChange={e => setEditForm(f => ({ ...f, pixPriceNum: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Duração do Acesso (dias)</Label>
                        <Input
                          type="number"
                          value={editForm.accessDurationDays || ''}
                          onChange={e => setEditForm(f => ({ ...f, accessDurationDays: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Ordem de Exibição</Label>
                        <Input
                          type="number"
                          value={editForm.displayOrder || ''}
                          onChange={e => setEditForm(f => ({ ...f, displayOrder: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`isActive-edit-${plan._id}`}
                          checked={editForm.isActive ?? true}
                          onCheckedChange={(checked) => setEditForm(f => ({ ...f, isActive: checked as boolean }))}
                        />
                        <Label htmlFor={`isActive-edit-${plan._id}`} className="text-xs font-medium cursor-pointer">
                          Plano Ativo
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Display Fields Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">👁️ Campos de Exibição</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Badge</Label>
                        <Input
                          value={editForm.badge || ''}
                          onChange={e => setEditForm(f => ({ ...f, badge: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Nome do Plano *</Label>
                        <Input
                          value={editForm.name || ''}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Preço Original (texto)</Label>
                        <Input
                          value={editForm.originalPrice || ''}
                          onChange={e => setEditForm(f => ({ ...f, originalPrice: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Preço Atual (texto) *</Label>
                        <Input
                          value={editForm.price || ''}
                          onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Parcelas</Label>
                        <Input
                          value={editForm.installments || ''}
                          onChange={e => setEditForm(f => ({ ...f, installments: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Detalhes das Parcelas</Label>
                        <Input
                          value={editForm.installmentDetails || ''}
                          onChange={e => setEditForm(f => ({ ...f, installmentDetails: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs font-medium">Descrição</Label>
                        <Input
                          value={editForm.description || ''}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs font-medium">Recursos (um por linha)</Label>
                        <Textarea
                          value={editForm.features || ''}
                          onChange={e => setEditForm(f => ({ ...f, features: e.target.value }))}
                          rows={4}
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Texto do Botão</Label>
                        <Input
                          value={editForm.buttonText || ''}
                          onChange={e => setEditForm(f => ({ ...f, buttonText: e.target.value }))}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={() => handleSavePlan(true)} size="sm" className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Alterações
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      <X className="w-4 h-4 mr-2" />
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
                      className="w-8 h-8 p-0 bg-white/80 hover:bg-white"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(plan._id)}
                      className="w-8 h-8 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Internal Info Banner */}
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <div className="flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <div className="font-mono text-gray-600">
                          <span className="font-semibold">ID:</span> {plan.productId}
                        </div>
                        {plan.category && (
                          <div className="text-gray-500">
                            <span className="font-semibold">Categoria:</span> {
                              plan.category === 'year_access' ? 'Acesso Anual' :
                              plan.category === 'premium_pack' ? 'Pacote Premium' :
                              'Add-on'
                            }
                            {plan.year && ` • ${plan.year}`}
                          </div>
                        )}
                        {(plan.regularPriceNum || plan.pixPriceNum) && (
                          <div className="text-gray-500">
                            {plan.regularPriceNum && <span>💳 R$ {plan.regularPriceNum.toFixed(2)}</span>}
                            {plan.pixPriceNum && <span className="ml-2"><strong>PIX</strong> R$ {plan.pixPriceNum.toFixed(2)}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          plan.isActive 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {plan.isActive ? '✓ Ativo' : '✗ Inativo'}
                        </span>
                        {plan.accessDurationDays && (
                          <span className="text-gray-500">
                            ⏱️ {plan.accessDurationDays} dias
                          </span>
                        )}
                        {plan.displayOrder !== undefined && (
                          <span className="text-gray-400 text-xs">
                            Ordem: {plan.displayOrder}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer-Facing Display */}
                  <div className="text-center py-4">
                    <div className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-600">
                      {plan.badge}
                    </div>
                  </div>

                  <div className="text-center px-6 pb-6">
                    <div className="h-20 flex flex-col justify-center">
                      <div className="text-lg line-through mb-2 text-red-500 min-h-[1.5em]">
                        {plan.originalPrice && <span>{plan.originalPrice}</span>}
                      </div>
                      <div className="text-4xl font-bold mb-2 text-gray-900">
                        {plan.price}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {plan.installments}
                    </div>
                  </div>

                  <div className="px-6 pb-6">
                    <p className="text-sm text-center text-gray-600">
                      {plan.description}
                    </p>
                  </div>

                  <div className="px-6 flex-grow">
                    <ul className="space-y-3">
                      {plan.features.map((feature: string, featureIndex: number) => (
                        <li key={featureIndex} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-blue-100">
                            <Check className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="text-sm text-gray-700">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-6 flex-shrink-0">
                    <div className={`w-full py-3 px-6 rounded-xl font-semibold text-sm text-center ${
                      plan.isActive 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-300 text-gray-600'
                    } shadow-lg`}>
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