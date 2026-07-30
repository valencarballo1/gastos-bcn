"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  CircleDollarSign,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import type { HouseholdData, ShoppingItem } from "@/types";
import { formatCurrency } from "@/utils/format";

interface ShoppingPageProps {
  data: HouseholdData;
  addShoppingItem: (
    item: Omit<ShoppingItem, "id" | "createdAt" | "purchased">,
  ) => void;
  toggleShoppingItem: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  finalizeShopping: (amount: number, paidByMemberId: string) => void;
}

export function ShoppingPage({
  data,
  addShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  finalizeShopping,
}: ShoppingPageProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = data.shoppingLists[0];
  const pending = list.items.filter((item) => !item.purchased);
  const purchased = list.items.filter((item) => item.purchased);
  const readyToFinalize = purchased.filter((item) => !item.expenseId);
  const estimate = pending.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);

  const grouped = useMemo(() => {
    const filtered = list.items.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase()),
    );
    return filtered.reduce<Record<string, ShoppingItem[]>>((groups, item) => {
      groups[item.category] = [...(groups[item.category] ?? []), item];
      return groups;
    }, {});
  }, [list.items, query]);

  return (
    <div>
      <PageHeader
        eyebrow="Compra compartida"
        title={list.name}
        description="Una lista viva para que nada falte y nadie compre dos veces lo mismo."
        action={
          <button className="button button-primary" onClick={() => setAddOpen(true)}>
            <Plus size={18} /> Agregar producto
          </button>
        }
      />

      <section className="shopping-overview">
        <div className="shopping-progress-card">
          <span className="summary-icon summary-icon-sage">
            <ShoppingBasket size={21} />
          </span>
          <div>
            <span>Progreso de la compra</span>
            <strong>
              {purchased.length} de {list.items.length}
            </strong>
          </div>
          <div className="shopping-ring" style={{ "--progress": `${(purchased.length / list.items.length) * 100}%` } as React.CSSProperties}>
            <span>{Math.round((purchased.length / list.items.length) * 100)}%</span>
          </div>
        </div>
        <div className="shopping-stat">
          <span>Pendientes</span>
          <strong>{pending.length}</strong>
          <small>{pending.filter((item) => item.priority === "high").length} prioritarios</small>
        </div>
        <div className="shopping-stat">
          <span>Estimado pendiente</span>
          <strong>{formatCurrency(estimate)}</strong>
          <small>Según precios guardados</small>
        </div>
      </section>

      <section className="shopping-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="Buscar en la lista..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          className="button button-secondary"
          disabled={!readyToFinalize.length}
          onClick={() => setFinishOpen(true)}
        >
          <CircleDollarSign size={17} />
          Finalizar compra ({readyToFinalize.length})
        </button>
      </section>

      <section className="shopping-list-layout">
        <div className="shopping-groups">
          {Object.entries(grouped).map(([category, items]) => (
            <article className="shopping-group" key={category}>
              <header>
                <div>
                  <span className="shopping-category-mark" />
                  <h2>{category}</h2>
                  <span>{items.length}</span>
                </div>
                <button className="icon-button">
                  <ChevronDown size={18} />
                </button>
              </header>
              <div>
                {items.map((item) => {
                  const member = data.members.find(
                    (memberItem) => memberItem.id === item.addedByMemberId,
                  );
                  return (
                    <div className={`shopping-item ${item.purchased ? "is-purchased" : ""}`} key={item.id}>
                      <button
                        className="round-check"
                        onClick={() => toggleShoppingItem(item.id)}
                        aria-label={
                          item.purchased
                            ? `Marcar ${item.name} como pendiente`
                            : `Marcar ${item.name} como comprado`
                        }
                      >
                        {item.purchased && <Check size={16} />}
                      </button>
                      <div className="shopping-item-main">
                        <strong>
                          {item.name}
                          {item.priority === "high" && <span className="priority-tag">Prioridad</span>}
                        </strong>
                        <span>
                          {item.quantity} {item.unit}
                          {item.supermarket ? ` · ${item.supermarket}` : ""}
                        </span>
                      </div>
                      <span className="item-estimate">
                        {item.estimatedPrice ? formatCurrency(item.estimatedPrice) : "—"}
                      </span>
                      <Avatar member={member} size="sm" />
                      <button
                        className="icon-button danger-button"
                        onClick={() => removeShoppingItem(item.id)}
                        aria-label={`Eliminar ${item.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <aside className="shopping-tip">
          <div className="tip-illustration">
            <ShoppingBasket size={30} />
          </div>
          <span className="eyebrow">Consejo de la semana</span>
          <h2>Marcá mientras comprás</h2>
          <p>
            La lista se actualiza en este dispositivo al instante. Al terminar, convertila en un gasto compartido.
          </p>
          <button className="text-button" onClick={() => setAddOpen(true)}>
            Agregar algo que falta <Plus size={15} />
          </button>
        </aside>
      </section>

      <ShoppingItemForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        data={data}
        onSubmit={(item) => {
          addShoppingItem(item);
          setAddOpen(false);
        }}
      />
      <FinishShoppingForm
        key={String(finishOpen)}
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        data={data}
        suggestedAmount={readyToFinalize.reduce(
          (sum, item) => sum + (item.estimatedPrice ?? 0),
          0,
        )}
        itemCount={readyToFinalize.length}
        onSubmit={(amount, payerId) => {
          finalizeShopping(amount, payerId);
          setFinishOpen(false);
        }}
      />
    </div>
  );
}

function ShoppingItemForm({
  open,
  onClose,
  data,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  data: HouseholdData;
  onSubmit: (item: Omit<ShoppingItem, "id" | "createdAt" | "purchased">) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("u");
  const [category, setCategory] = useState("Despensa");
  const [memberId, setMemberId] = useState(data.members.find((member) => member.active)?.id ?? "");
  const [estimate, setEstimate] = useState("");
  const [priority, setPriority] = useState<ShoppingItem["priority"]>("normal");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      quantity: Number(quantity),
      unit,
      category,
      addedByMemberId: memberId,
      priority,
      estimatedPrice: estimate ? Number(estimate) : undefined,
    });
    setName("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar producto" subtitle="Rápido y simple, como anotarlo en un papel.">
      <form className="app-form" onSubmit={submit}>
        <label className="field">
          <span>Producto</span>
          <input
            autoFocus
            placeholder="Ej. Café"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Cantidad</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Unidad</span>
            <select value={unit} onChange={(event) => setUnit(event.target.value)}>
              {["u", "kg", "g", "l", "ml", "paq."].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Categoría</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {["Frutas y verduras", "Lácteos", "Bebidas", "Limpieza", "Higiene", "Despensa", "Otros"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label className="field">
            <span>Agregado por</span>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              {data.members
                .filter((member) => member.active)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Precio estimado</span>
            <div className="input-prefix">
              <span>€</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
              />
            </div>
          </label>
          <label className="field">
            <span>Prioridad</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as ShoppingItem["priority"])}
            >
              <option value="normal">Normal</option>
              <option value="high">Prioritario</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit">
            Agregar a la lista
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FinishShoppingForm({
  open,
  onClose,
  data,
  suggestedAmount,
  itemCount,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  data: HouseholdData;
  suggestedAmount: number;
  itemCount: number;
  onSubmit: (amount: number, payerId: string) => void;
}) {
  const [amount, setAmount] = useState(suggestedAmount ? suggestedAmount.toFixed(2) : "");
  const [payerId, setPayerId] = useState(
    data.members.find((member) => member.active)?.id ?? "",
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Finalizar compra"
      subtitle={`Se crearán un gasto y el reparto para ${itemCount} productos.`}
    >
      <form
        className="app-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (Number(amount) > 0) onSubmit(Number(amount), payerId);
        }}
      >
        <label className="field">
          <span>Total real del ticket</span>
          <div className="input-prefix input-prefix-large">
            <span>€</span>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </label>
        <label className="field">
          <span>¿Quién pagó?</span>
          <select value={payerId} onChange={(event) => setPayerId(event.target.value)}>
            {data.members
              .filter((member) => member.active)
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
        </label>
        <div className="conversion-note">
          <CircleDollarSign size={20} />
          <p>
            <strong>Se dividirá en partes iguales.</strong>
            <span>Podrás editar el reparto desde Gastos después de conectarlo al backend.</span>
          </p>
        </div>
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Volver
          </button>
          <button type="submit" className="button button-primary">
            Crear gasto compartido
          </button>
        </div>
      </form>
    </Modal>
  );
}
