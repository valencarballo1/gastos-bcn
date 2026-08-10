"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  CircleDollarSign,
  ListFilter,
  ListPlus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBasket,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { errorMessage } from "@/services/api";
import type { HouseholdData, ShoppingItem } from "@/types";
import { formatCurrency, formatLongDate } from "@/utils/format";
import { openShoppingList, shoppingItemPrice } from "@/utils/shopping";

interface ShoppingPageProps {
  data: HouseholdData;
  addShoppingItem: (
    item: Omit<ShoppingItem, "id" | "createdAt" | "purchased" | "rowVersion">,
  ) => Promise<unknown>;
  toggleShoppingItem: (id: string) => Promise<unknown>;
  updateShoppingItemPrice: (id: string, actualPrice: number) => Promise<unknown>;
  removeShoppingItem: (id: string) => Promise<unknown>;
  finalizeShopping: (amount: number, paidByMemberId: string) => Promise<unknown>;
}

export function ShoppingPage({
  data,
  addShoppingItem,
  toggleShoppingItem,
  updateShoppingItemPrice,
  removeShoppingItem,
  finalizeShopping,
}: ShoppingPageProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [pricedItem, setPricedItem] = useState<ShoppingItem | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const list = openShoppingList(data.shoppingLists) ?? data.shoppingLists[0];
  const pending = list.items.filter((item) => !item.purchased);
  const purchased = list.items.filter((item) => item.purchased);
  const readyToFinalize = purchased.filter((item) => !item.expenseId);
  const estimate = list.items.reduce(
    (sum, item) => sum + (item.estimatedPrice ?? 0),
    0,
  );
  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(list.items.map((item) => item.category)))],
    [list.items],
  );
  const visibleItems = list.items.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) &&
      (category === "Todas" || item.category === category),
  );
  const progress = list.items.length
    ? Math.round((purchased.length / list.items.length) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Lista conjunta"
        title={list.name}
        description="Todo a la vista, como un ticket compartido: recorré la lista y marcá mientras comprás."
        action={
          <button className="button button-primary" onClick={() => setAddOpen(true)}>
            <Plus size={18} /> Agregar producto
          </button>
        }
      />

      <section className="ticket-topbar">
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="Buscar en el ticket..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="ticket-category-filter" aria-label="Filtrar por categoría">
          <ListFilter size={16} />
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="receipt-layout">
        <article className="shopping-receipt">
          <header className="receipt-header">
            <div className="receipt-brand">
              <span>
                <ShoppingBasket size={23} />
              </span>
              <div>
                <strong>Casa Clara</strong>
                <small>{data.household.name}</small>
              </div>
            </div>
            <div className="receipt-meta">
              <span>LISTA COMPARTIDA</span>
              <strong>{formatLongDate(list.weekOf, data.household.timezone)}</strong>
            </div>
          </header>

          <div className="receipt-progress">
            <div>
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>
              <strong>{progress}% listo</strong>
              <span>
                {purchased.length} comprados · {pending.length} pendientes
              </span>
            </p>
            <div className="member-stack">
              {data.members
                .filter((member) => member.active)
                .map((member) => (
                  <Avatar key={member.id} member={member} size="sm" />
                ))}
            </div>
          </div>

          <div className="receipt-columns" aria-hidden="true">
            <span>Producto</span>
            <span>Cant.</span>
            <span>Estimado</span>
          </div>

          <div className="receipt-items">
            {visibleItems.map((item) => {
              const member = data.members.find(
                (memberItem) => memberItem.id === item.addedByMemberId,
              );
              return (
                <div
                  className={`receipt-item ${item.purchased ? "is-purchased" : ""}`}
                  key={item.id}
                >
                  <button
                    className="receipt-check"
                    onClick={() => void toggleShoppingItem(item.id)}
                    aria-label={
                      item.purchased
                        ? `Marcar ${item.name} como pendiente`
                        : `Marcar ${item.name} como comprado`
                    }
                  >
                    {item.purchased && <Check size={17} />}
                  </button>
                  <div className="receipt-product">
                    <strong>
                      {item.name}
                      {item.priority === "high" && <i>Prioridad</i>}
                    </strong>
                    <span>
                      <em>{item.category}</em>
                      {item.supermarket ? ` · ${item.supermarket}` : ""}
                    </span>
                  </div>
                  <span className="receipt-quantity">
                    {item.quantity} {item.unit}
                  </span>
                  {item.purchased ? (
                    <button
                      className="receipt-price receipt-price-button"
                      onClick={() => setPricedItem(item)}
                    >
                      {item.actualPrice != null
                        ? formatCurrency(item.actualPrice)
                        : "Agregar precio"}
                    </button>
                  ) : (
                    <span className="receipt-price">
                      {item.estimatedPrice
                        ? formatCurrency(item.estimatedPrice)
                        : "—"}
                    </span>
                  )}
                  <Avatar member={member} size="sm" />
                  <button
                    className="receipt-remove"
                    onClick={() => {
                      if (window.confirm(`¿Quitar ${item.name} de la lista?`)) {
                        void removeShoppingItem(item.id);
                      }
                    }}
                    aria-label={`Eliminar ${item.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            {!visibleItems.length && (
              <div className="receipt-empty">
                <ReceiptText size={28} />
                <strong>No hay productos con este filtro</strong>
                <span>Probá otra categoría o agregá algo nuevo.</span>
              </div>
            )}
          </div>

          <footer className="receipt-footer">
            <div>
              <span>Productos</span>
              <strong>{list.items.length}</strong>
            </div>
            <div>
              <span>Estimado total</span>
              <strong>{formatCurrency(estimate)}</strong>
            </div>
            <p>Gracias por comprar en equipo</p>
            <span className="receipt-barcode" aria-hidden="true" />
          </footer>
        </article>

        <aside className="ticket-actions-card">
          <span className="ticket-actions-icon">
            <ReceiptText size={25} />
          </span>
          <span className="eyebrow">Al terminar</span>
          <h2>Convertí el ticket en gasto</h2>
          <p>
            Marcá lo comprado, cargá el total real y elegí quién pagó. El balance se
            actualizará automáticamente.
          </p>
          <dl>
            <div>
              <dt>Listos para cerrar</dt>
              <dd>{readyToFinalize.length}</dd>
            </div>
            <div>
              <dt>Estimado comprado</dt>
              <dd>
                {formatCurrency(
                  readyToFinalize.reduce(
                    (sum, item) => sum + shoppingItemPrice(item),
                    0,
                  ),
                )}
              </dd>
            </div>
          </dl>
          <button
            className="button button-primary"
            disabled={!readyToFinalize.length}
            onClick={() => setFinishOpen(true)}
          >
            <CircleDollarSign size={17} />
            Finalizar compra
          </button>
          <button className="button button-secondary" onClick={() => setAddOpen(true)}>
            <Plus size={17} />
            Agregar otro producto
          </button>
        </aside>
      </section>

      <ShoppingItemForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        data={data}
        onSubmit={async (item) => {
          await addShoppingItem(item);
          setAddOpen(false);
        }}
      />
      <FinishShoppingForm
        key={String(finishOpen)}
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        data={data}
        suggestedAmount={readyToFinalize.reduce(
          (sum, item) => sum + shoppingItemPrice(item),
          0,
        )}
        itemCount={readyToFinalize.length}
        onSubmit={async (amount, payerId) => {
          await finalizeShopping(amount, payerId);
          setFinishOpen(false);
        }}
      />
      <ShoppingItemPriceForm
        key={pricedItem?.id ?? "closed"}
        item={pricedItem}
        onClose={() => setPricedItem(null)}
        onSubmit={async (actualPrice) => {
          if (!pricedItem) return;
          await updateShoppingItemPrice(pricedItem.id, actualPrice);
          setPricedItem(null);
        }}
      />
    </div>
  );
}

function ShoppingItemPriceForm({
  item,
  onClose,
  onSubmit,
}: {
  item: ShoppingItem | null;
  onClose: () => void;
  onSubmit: (actualPrice: number) => Promise<unknown>;
}) {
  const [price, setPrice] = useState(
    item?.actualPrice != null ? String(item.actualPrice) : "",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const actualPrice = Number(price);
    if (!price || !Number.isFinite(actualPrice) || actualPrice < 0) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(actualPrice);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={`Precio de ${item?.name ?? "producto"}`}
      subtitle="Cargá el precio real que figura en el ticket."
    >
      <form className="app-form" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Precio real</span>
          <div className="input-prefix">
            <span>€</span>
            <input
              autoFocus
              required
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar precio"}
          </button>
        </div>
      </form>
    </Modal>
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
  onSubmit: (item: Omit<ShoppingItem, "id" | "createdAt" | "purchased" | "rowVersion">) => Promise<unknown>;
}) {
  const shoppingCategories = data.categories.filter(
    (category) => category.type === "shopping",
  );
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [name, setName] = useState("");
  const [namesText, setNamesText] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("u");
  const [categoryId, setCategoryId] = useState(
    shoppingCategories[0]?.id ?? "",
  );
  const [memberId, setMemberId] = useState(
    data.members.find((member) => member.active)?.id ?? "",
  );
  const [estimate, setEstimate] = useState("");
  const [priority, setPriority] = useState<ShoppingItem["priority"]>("normal");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const bulkNames = namesText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const categoryName =
    shoppingCategories.find((item) => item.id === categoryId)?.name ?? "Otros";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (mode === "bulk") {
      if (!bulkNames.length) {
        setError("Escribí al menos un producto, separado por comas.");
        return;
      }
      setSubmitting(true);
      setError("");
      try {
        await Promise.all(
          bulkNames.map((productName) =>
            onSubmit({
              name: productName,
              quantity: 1,
              unit: "u",
              categoryId,
              category: categoryName,
              addedByMemberId: memberId,
              priority: "normal",
              estimatedPrice: undefined,
            }),
          ),
        );
        setNamesText("");
      } catch (reason) {
        setError(errorMessage(reason));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        quantity: Number(quantity),
        unit,
        categoryId,
        category: categoryName,
        addedByMemberId: memberId,
        priority,
        estimatedPrice: estimate ? Number(estimate) : undefined,
      });
      setName("");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar al ticket"
      subtitle={
        mode === "bulk"
          ? "Elegí la categoría y escribí los productos separados por coma: se agregan todos con cantidad 1."
          : "Aparecerá al instante en la lista conjunta."
      }
    >
      <form className="app-form" onSubmit={(event) => void submit(event)}>
        <div className="segmented-control invitation-mode">
          <button
            type="button"
            className={mode === "single" ? "active" : ""}
            onClick={() => setMode("single")}
          >
            <Plus size={16} /> Un producto
          </button>
          <button
            type="button"
            className={mode === "bulk" ? "active" : ""}
            onClick={() => setMode("bulk")}
          >
            <ListPlus size={16} /> Varios a la vez
          </button>
        </div>

        {mode === "single" ? (
          <label className="field">
            <span>Producto</span>
            <input
              autoFocus
              placeholder="Ej. Café"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        ) : (
          <label className="field">
            <span>Productos (separados por coma)</span>
            <textarea
              autoFocus
              rows={3}
              placeholder="Ej. Champú, acondicionador, jabón"
              value={namesText}
              onChange={(event) => setNamesText(event.target.value)}
            />
          </label>
        )}

        <div className="form-grid">
          {mode === "single" && (
            <>
              <label className="field">
                <span>Cantidad</span>
                <input
                  type="number"
                  inputMode="decimal"
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
            </>
          )}
          <label className="field">
            <span>Categoría</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {shoppingCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Agregado por</span>
            <select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              {data.members
                .filter((member) => member.active)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          {mode === "single" && (
            <>
              <label className="field">
                <span>Precio estimado</span>
                <div className="input-prefix">
                  <span>€</span>
                  <input
                    type="number"
                    inputMode="decimal"
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
                  onChange={(event) =>
                    setPriority(event.target.value as ShoppingItem["priority"])
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="high">Prioritario</option>
                </select>
              </label>
            </>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={submitting || (mode === "bulk" && !bulkNames.length)}
          >
            {submitting
              ? "Agregando…"
              : mode === "bulk"
                ? bulkNames.length
                  ? `Agregar ${bulkNames.length} producto${bulkNames.length === 1 ? "" : "s"}`
                  : "Agregar productos"
                : "Agregar al ticket"}
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
  onSubmit: (amount: number, payerId: string) => Promise<unknown>;
}) {
  const [amount, setAmount] = useState(
    suggestedAmount ? suggestedAmount.toFixed(2) : "",
  );
  const [payerId, setPayerId] = useState(
    data.members.find((member) => member.active)?.id ?? "",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (Number(amount) <= 0 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(Number(amount), payerId);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Finalizar compra"
      subtitle={`Se crearán un gasto y el reparto para ${itemCount} productos.`}
    >
      <form
        className="app-form"
        onSubmit={(event) => void submit(event)}
      >
        <label className="field">
          <span>Total real del ticket</span>
          <div className="input-prefix input-prefix-large">
            <span>€</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </label>
        <label className="field">
          <span>¿Quién pagó?</span>
          <select
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
          >
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
          <Users size={20} />
          <p>
            <strong>Se dividirá entre los integrantes activos.</strong>
            <span>El backend permitirá ajustar el reparto antes de confirmar.</span>
          </p>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Volver
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? "Finalizando…" : "Crear gasto compartido"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
