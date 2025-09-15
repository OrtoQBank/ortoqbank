'use client';

import { useMutation, useQuery } from 'convex/react';
import { Check, Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { api } from '../../../../../convex/_generated/api';
import { Id } from '../../../../../convex/_generated/dataModel';

type PricingPlan = {
  _id: Id<'pricingPlans'>;
  name: string;
  badge: string;
  originalPrice: string;
  price: string;
  installments: string;
  installmentDetails: string;
  description: string;
  features: string[];
  buttonText: string;
};

export default function PricingPlansAdminPage() {
  const plans = useQuery(api.pricingPlans.getPricingPlans) || [];
  const createPlan = useMutation(api.pricingPlans.savePricingPlan);
  const updatePlan = useMutation(api.pricingPlans.savePricingPlan);
  const removePlan = useMutation(api.pricingPlans.removePricingPlan);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name?: string;
    badge?: string;
    originalPrice?: string;
    price?: string;
    installments?: string;
    installmentDetails?: string;
    description?: string;
    features?: string;
    buttonText?: string;
    popular?: boolean;
  }>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    badge: '',
    originalPrice: '',
    price: '',
    installments: '',
    installmentDetails: '',
    description: '',
    features: '',
    buttonText: '',
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
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function saveEdit() {
    if (!editingId || !editForm.name?.trim() || !editForm.price?.trim()) return;

    const features = editForm.features
      ?.split('\n')
      .map((f: string) => f.trim())
      .filter((f: string) => f.length > 0) || [];

    await updatePlan({
      id: editingId as Id<'pricingPlans'>,
      name: editForm.name.trim(),
      badge: editForm.badge?.trim() || '',
      originalPrice: editForm.originalPrice?.trim() || '',
      price: editForm.price.trim(),
      installments: editForm.installments?.trim() || '',
      installmentDetails: editForm.installmentDetails?.trim() || '',
      description: editForm.description?.trim() || '',
      features,
      buttonText: editForm.buttonText?.trim() || '',
    });

    cancelEdit();
  }

  async function handleCreate() {
    if (!createForm.name.trim() || !createForm.price.trim()) return;

    const features = createForm.features
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    await createPlan({
      name: createForm.name.trim(),
      badge: createForm.badge.trim(),
      originalPrice: createForm.originalPrice.trim(),
      price: createForm.price.trim(),
      installments: createForm.installments.trim(),
      installmentDetails: createForm.installmentDetails.trim(),
      description: createForm.description.trim(),
      features,
      buttonText: createForm.buttonText.trim(),
    });

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
    });
    setIsCreating(false);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto px-4">
          {isCreating && (
            <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden w-full min-h-[500px] flex flex-col border-2 border-dashed border-blue-300">
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Badge</Label>
                  <Input
                    value={createForm.badge}
                    onChange={e => setCreateForm(f => ({ ...f, badge: e.target.value }))}
                    placeholder="Ex: Mais Popular"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do plano"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Preço Original</Label>
                  <Input
                    value={createForm.originalPrice}
                    onChange={e => setCreateForm(f => ({ ...f, originalPrice: e.target.value }))}
                    placeholder="Ex: R$ 299"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Preço Atual</Label>
                  <Input
                    value={createForm.price}
                    onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Ex: R$ 199"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    value={createForm.installments}
                    onChange={e => setCreateForm(f => ({ ...f, installments: e.target.value }))}
                    placeholder="Ex: 12x de R$ 16,58"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descrição do plano"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Recursos (um por linha)</Label>
                  <Textarea
                    value={createForm.features}
                    onChange={e => setCreateForm(f => ({ ...f, features: e.target.value }))}
                    placeholder="Acesso completo&#10;Suporte 24/7"
                    rows={3}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Texto do Botão</Label>
                  <Input
                    value={createForm.buttonText}
                    onChange={e => setCreateForm(f => ({ ...f, buttonText: e.target.value }))}
                    placeholder="Ex: Começar Agora"
                    className="text-xs"
                  />
                </div>



                <div className="flex gap-2 pt-2">
                  <Button onClick={handleCreate} size="sm" className="flex-1">
                    <Save className="w-3 h-3 mr-1" />
                    Criar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreating(false)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {plans?.map((plan) => (
            <div
              key={plan._id}
              className="relative bg-white rounded-2xl shadow-xl overflow-hidden w-full min-h-[500px] flex flex-col"
            >
              {editingId === plan._id ? (
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Badge</Label>
                    <Input
                      value={editForm.badge || ''}
                      onChange={e => setEditForm(f => ({ ...f, badge: e.target.value }))}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={editForm.name || ''}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Preço Original</Label>
                    <Input
                      value={editForm.originalPrice || ''}
                      onChange={e => setEditForm(f => ({ ...f, originalPrice: e.target.value }))}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Preço Atual</Label>
                    <Input
                      value={editForm.price || ''}
                      onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Parcelas</Label>
                    <Input
                      value={editForm.installments || ''}
                      onChange={e => setEditForm(f => ({ ...f, installments: e.target.value }))}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={editForm.description || ''}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Recursos (um por linha)</Label>
                    <Textarea
                      value={editForm.features || ''}
                      onChange={e => setEditForm(f => ({ ...f, features: e.target.value }))}
                      rows={3}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Texto do Botão</Label>
                    <Input
                      value={editForm.buttonText || ''}
                      onChange={e => setEditForm(f => ({ ...f, buttonText: e.target.value }))}
                      className="text-xs"
                    />
                  </div>

             

                  <div className="flex gap-2 pt-2">
                    <Button onClick={saveEdit} size="sm" className="flex-1">
                      <Save className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      <X className="w-3 h-3" />
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
                    <div className={`w-full py-3 px-6 rounded-xl font-semibold text-sm text-center bg-blue-500 text-white shadow-lg`}>
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