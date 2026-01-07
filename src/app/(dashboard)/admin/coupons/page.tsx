'use client';

import { useMutation } from 'convex/react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTenantQuery } from '@/hooks/useTenantQuery';

import { api } from '../../../../../convex/_generated/api';

const toEpoch = (s: string | undefined) =>
  s ? new Date(s).getTime() : undefined;
const fromEpoch = (n: number | undefined) =>
  n ? new Date(n).toISOString().slice(0, 16) : '';

type CouponType = 'percentage' | 'fixed' | 'fixed_price';

export default function CouponsAdminPage() {
  const coupons = useTenantQuery(api.promoCoupons.list, {}) || [];
  const createCoupon = useMutation(api.promoCoupons.create);
  const updateCoupon = useMutation(api.promoCoupons.update);
  const removeCoupon = useMutation(api.promoCoupons.remove);

  const [form, setForm] = useState({
    code: '',
    type: 'percentage' as CouponType,
    value: 15,
    description: '',
    active: true,
    validFrom: '',
    validUntil: '',
  });

  const nowIso = useMemo(() => new Date().toISOString().slice(0, 16), []);

  async function handleCreate() {
    if (!form.code.trim()) return;
    await createCoupon({
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      description:
        form.description ||
        `${form.value}${form.type === 'percentage' ? '% off' : ''}`,
      active: form.active,
      validFrom: toEpoch(form.validFrom),
      validUntil: toEpoch(form.validUntil),
    });
    setForm({
      code: '',
      type: 'percentage',
      value: 15,
      description: '',
      active: true,
      validFrom: '',
      validUntil: '',
    });
  }

  async function handleToggleActive(id: string, active: boolean) {
    await updateCoupon({ id: id as any, active });
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir cupom?')) return;
    await removeCoupon({ id: id as any });
  }

  return (
    <div className="space-y-6 p-0 md:p-6">
      <h1 className="text-2xl font-bold">Cupons</h1>

      <Card>
        <CardHeader>
          <CardTitle>Criar novo cupom</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Código</Label>
            <Input
              value={form.code}
              onChange={e =>
                setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))
              }
              placeholder="EX: SOMOS1K"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.type}
              onValueChange={(v: CouponType) =>
                setForm(f => ({ ...f, type: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentual (%)</SelectItem>
                <SelectItem value="fixed">Desconto fixo (R$)</SelectItem>
                <SelectItem value="fixed_price">Preço fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              step="0.01"
              value={form.value}
              onChange={e =>
                setForm(f => ({ ...f, value: Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={form.description}
              onChange={e =>
                setForm(f => ({ ...f, description: e.target.value }))
              }
              placeholder="Descrição mostrada no checkout"
            />
          </div>
          <div className="space-y-2">
            <Label>Ativo</Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Válido a partir de</Label>
            <Input
              type="datetime-local"
              value={form.validFrom}
              max={form.validUntil || undefined}
              onChange={e =>
                setForm(f => ({ ...f, validFrom: e.target.value }))
              }
              placeholder={nowIso}
            />
          </div>
          <div className="space-y-2">
            <Label>Válido até</Label>
            <Input
              type="datetime-local"
              value={form.validUntil}
              min={form.validFrom || undefined}
              onChange={e =>
                setForm(f => ({ ...f, validUntil: e.target.value }))
              }
              placeholder={nowIso}
            />
          </div>
          <div className="col-span-full">
            <Button onClick={handleCreate} className="w-full">
              Criar Cupom
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {coupons.map(c => (
          <Card key={c._id}>
            <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-muted-foreground text-sm">Código</div>
                <div className="text-lg font-semibold">{c.code}</div>
                <div className="text-sm">{c.description}</div>
                <div className="text-muted-foreground text-xs">
                  {c.type} • valor {c.value} • {c.active ? 'Ativo' : 'Inativo'}
                </div>
                <div className="text-muted-foreground text-xs">
                  {c.validFrom ? `de ${fromEpoch(c.validFrom)} ` : ''}
                  {c.validUntil ? `até ${fromEpoch(c.validUntil)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={c.active}
                  onCheckedChange={v => handleToggleActive(c._id, !!v)}
                />
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(c._id)}
                >
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
