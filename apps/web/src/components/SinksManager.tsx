import { FormEvent, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Sink } from '@trackeovrconia/proto';
import { useAppStore } from '../state/store';

interface SinkFormState {
  type: 'osc' | 'slimevr';
  host: string;
  port: number;
  namespace: string;
  profileId: string;
}

const defaultForm: SinkFormState = {
  type: 'osc',
  host: '127.0.0.1',
  port: 9000,
  namespace: '/body',
  profileId: 'default',
};

const SinksManager = () => {
  const sinks = useAppStore((state) => state.sinks);
  const setSinks = useAppStore((state) => state.setSinks);
  const [form, setForm] = useState<SinkFormState>(defaultForm);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload: Sink =
      form.type === 'osc'
        ? { id: uuid(), type: 'osc', host: form.host, port: form.port, namespace: form.namespace, flat: false }
        : { id: uuid(), type: 'slimevr', host: form.host, port: form.port, profileId: form.profileId };
    const res = await fetch('/api/sinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSinks([...sinks, payload]);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/sinks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSinks(sinks.filter((sink) => sink.id !== id));
    }
  };

  return (
    <section className="rounded-lg bg-slate-800 p-4 shadow">
      <header className="mb-3">
        <h2 className="text-lg font-semibold">Destinos OSC / SlimeVR</h2>
      </header>
      <form className="grid gap-3" onSubmit={submit}>
        <label className="text-sm">
          Tipo
          <select
            className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2"
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as SinkFormState['type'] }))}
          >
            <option value="osc">OSC</option>
            <option value="slimevr">SlimeVR</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Host
            <input
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2"
              value={form.host}
              onChange={(event) => setForm((prev) => ({ ...prev, host: event.target.value }))}
            />
          </label>
          <label className="text-sm">
            Puerto
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2"
              value={form.port}
              onChange={(event) => setForm((prev) => ({ ...prev, port: Number(event.target.value) }))}
            />
          </label>
        </div>
        {form.type === 'osc' ? (
          <label className="text-sm">
            Namespace
            <input
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2"
              value={form.namespace}
              onChange={(event) => setForm((prev) => ({ ...prev, namespace: event.target.value }))}
            />
          </label>
        ) : (
          <label className="text-sm">
            Perfil SlimeVR
            <input
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2"
              value={form.profileId}
              onChange={(event) => setForm((prev) => ({ ...prev, profileId: event.target.value }))}
            />
          </label>
        )}
        <button type="submit" className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900">
          Añadir destino
        </button>
      </form>
      <ul className="mt-4 space-y-2 text-sm">
        {sinks.map((sink) => (
          <li key={sink.id} className="flex items-center justify-between rounded bg-slate-900/60 p-2">
            <span>
              {sink.type.toUpperCase()} → {sink.host}:{sink.port}
            </span>
            <button className="text-xs text-rose-400" onClick={() => remove(sink.id)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default SinksManager;
