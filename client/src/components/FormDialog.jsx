import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { specs } from '../lib/forms.js';
import { Button } from './ui.jsx';

function Field({ f, value, onChange }) {
  const common = { id: `f-${f.name}`, name: f.name, required: f.required, value: value ?? '', onChange: (e) => onChange(f.name, e.target.value) };
  let input;
  if (f.type === 'select') {
    input = (
      <select {...common}>
        {f.options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    );
  } else if (f.type === 'textarea') {
    input = <textarea {...common} rows={2} />;
  } else {
    input = <input {...common} type={f.type || 'text'} min={f.min} placeholder={f.placeholder} />;
  }
  return (
    <label className="field">
      <span>{f.label}</span>
      {input}
    </label>
  );
}

// form = { table, record, extra, month } or null. Saves through the REST API.
export function FormDialog({ form, data, onClose, onSaved }) {
  const ref = useRef(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (form && !dialog.open) {
      const s = specs[form.table](data, form.record, form.month);
      setSpec(s);
      setValues(form.record || { ...s.defaults, ...form.extra });
      setError('');
      dialog.showModal();
    } else if (!form && dialog.open) {
      dialog.close();
    }
  }, [form, data]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const path = form.record ? `${form.table}/${form.record.id}` : form.table;
      await api(form.record ? 'PUT' : 'POST', path, values);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      {spec && (
        <form onSubmit={submit}>
          <h2>{spec.title}</h2>
          {spec.fields.map((f) => (
            <Field key={f.name} f={f} value={values[f.name]} onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))} />
          ))}
          <p className="error" role="alert">{error}</p>
          <div className="actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">Save</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
