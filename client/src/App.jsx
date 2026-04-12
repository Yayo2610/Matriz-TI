import { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Laptop, User as UserIcon, LogOut, PlusCircle, ShieldCheck, Pencil, X } from 'lucide-react';

function App() {
  const [assets, setAssets] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(localStorage.getItem('username'));
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  
  // Estados para el CRUD
  const [form, setForm] = useState({ serialNumber: '', brand: '', model: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const fetchAssets = async () => {
    const res = await axios.get('http://localhost:5000/api/assets');
    setAssets(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`http://localhost:5000/api/assets/${editId}`, form);
        setIsEditing(false);
        setEditId(null);
      } else {
        await axios.post('http://localhost:5000/api/assets', form);
      }
      setForm({ serialNumber: '', brand: '', model: '' });
      fetchAssets();
    } catch (err) { alert("Error: Revisa el S/N (debe ser único)"); }
  };

  const startEdit = (asset) => {
    setForm({ serialNumber: asset.serialNumber, brand: asset.brand, model: asset.model });
    setEditId(asset._id);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setForm({ serialNumber: '', brand: '', model: '' });
    setIsEditing(false);
    setEditId(null);
  };

  const deleteAsset = async (id) => {
    if (window.confirm("¿Confirmas la baja de este activo?")) {
      await axios.delete(`http://localhost:5000/api/assets/${id}`);
      fetchAssets();
    }
  };

  useEffect(() => { if (token) fetchAssets(); }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-md bg-[#111827] p-8 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-600/20 p-4 rounded-full mb-4"><ShieldCheck size={40} className="text-blue-500" /></div>
            <h1 className="text-2xl font-black tracking-tight">ASSETTRACK <span className="text-blue-500">PRO</span></h1>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await axios.post('http://localhost:5000/api/auth/login', credentials);
              localStorage.setItem('token', res.data.token);
              localStorage.setItem('username', res.data.username);
              setToken(res.data.token);
              setUser(res.data.username);
            } catch (err) { alert("Credenciales incorrectas"); }
          }} className="space-y-4">
            <input className="w-full p-4 bg-[#1f2937] rounded-xl outline-none border border-transparent focus:border-blue-500" placeholder="Usuario" onChange={e => setCredentials({...credentials, username: e.target.value})} required />
            <input className="w-full p-4 bg-[#1f2937] rounded-xl outline-none border border-transparent focus:border-blue-500" type="password" placeholder="Contraseña" onChange={e => setCredentials({...credentials, password: e.target.value})} required />
            <button className="w-full bg-blue-600 p-4 rounded-xl font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-600/20">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans">
      <header className="border-b border-white/5 bg-[#111827]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg"><Laptop className="text-white" size={24} /></div>
            <span className="text-xl font-black text-white">ASSETTRACK PRO</span>
          </div>
          <button onClick={() => { localStorage.clear(); setToken(null); }} className="text-slate-400 hover:text-red-400 flex items-center gap-2 transition cursor-pointer">
            <LogOut size={20} /> <span className="hidden md:inline text-sm font-bold uppercase tracking-widest">Salir</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4">
          <div className="bg-[#111827] p-8 rounded-3xl border border-white/5 sticky top-28">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              {isEditing ? <Pencil className="text-yellow-500" /> : <PlusCircle className="text-blue-500" />}
              {isEditing ? 'Editar Activo' : 'Registrar Activo'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50" placeholder="S/N" value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})} required />
              <input className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50" placeholder="Marca" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} required />
              <input className="w-full p-3 bg-[#1f2937] rounded-xl outline-none focus:ring-2 ring-blue-500/50" placeholder="Modelo" value={form.model} onChange={e => setForm({...form, model: e.target.value})} required />
              <button className={`w-full p-4 rounded-xl font-bold text-white transition ${isEditing ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {isEditing ? 'Guardar Cambios' : 'Registrar'}
              </button>
              {isEditing && (
                <button type="button" onClick={cancelEdit} className="w-full text-sm text-slate-500 hover:text-white flex items-center justify-center gap-2">
                  <X size={16} /> Cancelar edición
                </button>
              )}
            </form>
          </div>
        </aside>

        <section className="lg:col-span-8 bg-[#111827] rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white uppercase tracking-widest text-sm">Inventario Actual</h2>
            <span className="bg-blue-500/10 text-blue-500 px-4 py-1 rounded-full text-xs font-black">{assets.length} ITEMS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-5 text-left">Hardware</th>
                  <th className="px-8 py-5 text-left">Serial No.</th>
                  <th className="px-8 py-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assets.map(a => (
                  <tr key={a._id} className="hover:bg-white/2 transition group">
                    <td className="px-8 py-5">
                      <div className="text-white font-bold">{a.brand}</div>
                      <div className="text-xs text-slate-500 uppercase">{a.model}</div>
                    </td>
                    <td className="px-8 py-5 font-mono text-sm text-blue-400/80">{a.serialNumber}</td>
                    <td className="px-8 py-5 text-right flex justify-end gap-2">
                      <button onClick={() => startEdit(a)} className="p-2 text-slate-500 hover:text-yellow-500 transition cursor-pointer">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => deleteAsset(a._id)} className="p-2 text-slate-500 hover:text-red-500 transition cursor-pointer">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

// Sprint Final: Lógica CRUD (Create, Read, Update, Delete) verificada.