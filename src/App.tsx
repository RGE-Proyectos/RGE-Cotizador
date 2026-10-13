'use client';
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@supabase/supabase-js';
import logoRge from './assets/RGE-logo2k25-3D-Photoroom.png';
import { 
  ShoppingCart, 
  Package, 
  Wrench, 
  Trash2, 
  Plus, 
  Minus, 
  FileText, 
  Phone, 
  User, 
  ArrowLeft, 
  CheckCircle2,
  Search,
  RotateCcw,
  Home
} from 'lucide-react';
const formatearMoneda = (monto: number): string => {
  return monto.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Inicialización de Supabase con tipado seguro para Vite
const supabaseUrl = (import.meta as Record<string, any>).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as Record<string, any>).env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ProductoCatalogo {
  id: string;
  sku: string;
  name: string;
  sale_price: number;
}

interface ItemCarrito {
  id: string;
  tipo: 'catalogo' | 'cancelaria';
  nombre: string;
  etiqueta?: string;
  ancho?: number;
  alto?: number;
  area_total?: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export default function CotizadorRGECompleto() {
  // Añadimos 'exito' a las vistas posibles
  const [vista, setVista] = useState<'inicio' | 'catalogo' | 'cancelaria' | 'resumen' | 'exito'>('inicio');
  
  // Datos del Cliente y Visita
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [flete, setFlete] = useState<number>(0);
  const [cargando, setCargando] = useState(false);

  // Carrito unificado
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);

  // Estados para Catálogo Multinegocio
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [busqueda, setBusqueda] = useState('');

  // Estados para Cancelería / Construcción (Medidas)
  const [tipoObra, setTipoObra] = useState('Ventana 1F-1C 3"');
  const [etiquetaObra, setEtiquetaObra] = useState('');
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');

  const [precioUnitarioInput, setPrecioUnitarioInput] = useState<string>('1970');

  // Cargar productos del catálogo desde Supabase
  useEffect(() => {
    async function cargarCatalogo() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, sku, name, product_prices(sale_price)')
          .eq('is_active', true);
        if (error) throw error;
        if (data) {
          const formateados: ProductoCatalogo[] = data.map((p: any) => {
            const rawPrice = Array.isArray(p.product_prices) 
              ? p.product_prices[0]?.sale_price 
              : p.product_prices?.sale_price;
            return {
              id: p.id,
              sku: p.sku || 'N/A',
              name: p.name,
              sale_price: Number(rawPrice) || 0,
            };
          });
          setProductos(formateados);
        }
      } catch (err) {
        console.error('Error al cargar catálogo:', err);
      }
    }
    cargarCatalogo();
  }, []);

  // Agregar producto de catálogo al carrito
  const agregarCatalogoAlCarrito = (prod: ProductoCatalogo) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === prod.id && item.tipo === 'catalogo');
      if (existe) {
        return prev.map(item =>
          item.id === prod.id && item.tipo === 'catalogo'
            ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio_unitario }
            : item
        );
      }
      return [
        ...prev,
        {
          id: prod.id,
          tipo: 'catalogo',
          nombre: prod.name,
          cantidad: 1,
          precio_unitario: prod.sale_price,
          subtotal: prod.sale_price,
        },
      ];
    });
  };

  // Agregar elemento de Cancelería / Construcción a la medida
  const agregarCancelariaAlCarrito = () => {
    console.log("VALOR ACTUAL EN EL INPUT:", precioUnitarioInput);
    if (!ancho || !alto) {
      alert('Por favor ingresa el ancho y el alto.');
      return;
    }
    const precioM2 = parseFloat(precioUnitarioInput) || 0;
    const w = parseFloat(ancho);
    const h = parseFloat(alto);
    const area = w * h;
    const subtotal = area * precioM2;
    const nuevoItem: ItemCarrito = {
      id: `canceleria-${Date.now()}`,
      tipo: 'cancelaria',
      nombre: tipoObra,
      etiqueta: etiquetaObra || tipoObra,
      ancho: w,
      alto: h,
      area_total: area,
      cantidad: 1,
      precio_unitario: precioM2,
      subtotal: subtotal,
    };
    setCarrito(prev => [...prev, nuevoItem]);
    setAncho('');
    setAlto('');
    setEtiquetaObra('');
    alert('¡Elemento agregado a la cotización!');
  };

  // Cambiar cantidad de artículos en el carrito
  const cambiarCantidad = (id: string, delta: number) => {
    setCarrito(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const nuevaCantidad = item.cantidad + delta;
            if (nuevaCantidad <= 0) return null;
            return {
              ...item,
              cantidad: nuevaCantidad,
              subtotal: nuevaCantidad * item.precio_unitario,
            };
          }
          return item;
        })
        .filter(Boolean) as ItemCarrito[]
    );
  };

  const eliminarItem = (id: string) => {
    setCarrito(prev => prev.filter(item => item.id !== id));
  };

  const calcularSubtotalGeneral = () => {
    return carrito.reduce((acc, item) => acc + item.subtotal, 0);
  };

  const calcularTotalFinal = () => {
    return calcularSubtotalGeneral() + Number(flete || 0);
  };

  // Reiniciar estado para una nueva cotización
  const reiniciarCotizacion = () => {
    setNombreCliente('');
    setTelefonoCliente('');
    setFlete(0);
    setCarrito([]);
    setVista('catalogo');
  };

  // Guardar en Supabase y Generar PDF
  const generarPDFyGuardar = async () => {
    if (!nombreCliente || !telefonoCliente || carrito.length === 0) {
      alert('Por favor completa el nombre, WhatsApp del cliente y agrega al menos un producto.');
      return;
    }
    setCargando(true);
    const totalFinal = calcularTotalFinal();
    
    try {
      for (const item of carrito) {
        const { error: dbError } = await supabase.from('cotizaciones').insert([
          {
            etiqueta: `${nombreCliente} - ${item.etiqueta || item.nombre}`,
            ancho: item.ancho || 0,
            alto: item.alto || 0,
            area_total: item.area_total || 0,
            costo_materiales: item.subtotal * 0.6,
            utilidad: item.subtotal * 0.4,
            precio_venta: item.subtotal,
            flete: Number(flete) / carrito.length,
            desglose_json: item,
          },
        ]);
        if (dbError) {
          console.warn('Aviso: No se pudo guardar este ítem en Supabase:', dbError);
        }
      }

      // Generación del documento PDF
      const doc = new jsPDF();
      const fechaStr = new Date().toLocaleDateString();
      const horaStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Encabezado Texto
      doc.setFontSize(20);
      doc.setTextColor(27, 54, 93);
      doc.text('RGE - MÉXICO', 14, 20);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text('Cotización de Cancelería y Artículos', 14, 26);

      // Logo corporativo en la esquina superior derecha
      //doc.setFillColor(27, 54, 93);
      //doc.roundedRect(165, 12, 30, 20, 2, 2, 'F');
      //doc.setTextColor(255, 255, 255);
      //doc.setFontSize(10);
      //doc.text('RGE', 173, 24);

// --- Logo corporativo en la esquina superior derecha ---
try {
  // Asegúrate de que el archivo esté dentro de la carpeta 'public' de tu proyecto
doc.addImage(logoRge, 'PNG', 155, 10, 42, 25);
} catch (error) {
  console.log("No se pudo cargar el logotipo", error);
}

      // Fecha, Hora y Datos del Cliente
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Fecha y Hora: ${fechaStr} - ${horaStr}`, 14, 34);
      doc.text(`Cliente: ${nombreCliente}`, 14, 40);
      doc.text(`Teléfono: ${telefonoCliente}`, 14, 46);

      // Mapeo de filas incluyendo SKU (sin la palabra "SKU") para artículos de catálogo
      const rows = carrito.map(item => {
        let descripcion = item.nombre;
        if (item.tipo === 'cancelaria') {
          descripcion = `${item.etiqueta}\n(Medidas: ${item.ancho}m x ${item.alto}m | ${item.area_total?.toFixed(2)} m²)`;
        } else if (item.tipo === 'catalogo') {
          const productoOriginal = productos.find(p => p.id === item.id);
          const codigoSku = productoOriginal && productoOriginal.sku ? productoOriginal.sku : '';
          // Ponemos el SKU arriba en la primera línea y el nombre abajo
          descripcion = codigoSku ? `${codigoSku}\n${item.nombre}` : item.nombre;
        }

        return [
          descripcion,
          item.cantidad,
          `$${item.precio_unitario.toFixed(2)}`,
          `$${item.subtotal.toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: 54,
        head: [['Descripción / Concepto', 'Cant./Área', 'P. Unitario', 'Subtotal']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [27, 54, 93] },
        // Estilo personalizado para hacer la primera línea (el SKU) más pequeña y gris
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const item = carrito[data.row.index];
            if (item && item.tipo === 'catalogo') {
              const productoOriginal = productos.find(p => p.id === item.id);
              if (productoOriginal && productoOriginal.sku) {
                // jsPDF autotable permite manipular celdas por estilos de texto o celdas divididas por saltos de línea.
                // Aquí aplicamos un estilo general más limpio para la celda.
              }
            }
          }
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
        // Ajustamos la celda para darle mayor control visual al SKU con fuente más chica si lo soporta el render, 
        // o dejamos que el salto de línea divida el SKU limpio del nombre del producto.
      });

      const finalY = (doc as any).lastAutoTable.finalY || 100;

      
// --- Cálculo del desplazamiento dinámico si hay flete ---
// const offsetFlete = Number(flete) > 0 ? 12 : 0;

// --- 1. Impresión del Flete (si aplica) ---
let currentY = finalY + 8;

if (Number(flete) > 0) {
  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text(`Flete / Instalación: $${Number(flete).toFixed(2)} MXN`, 14, currentY);
  currentY += 15; // Avanzamos el puntero vertical
}

// --- 2 y 3. Leyendas de Vigencia y Tiempo de Entrega ---
doc.setFontSize(9);
doc.setTextColor(100);
doc.text('• Vigencia de esta cotización: 9 días hábiles.', 14, currentY);
currentY += 6;

doc.text('• Tiempo de entrega: 10 a 15 días hábiles a partir de la recepción del 60% de anticipo.', 14, currentY);
currentY += 12; // Espacio extra antes del Total Final

// --- 4. Total Final ---
doc.setFontSize(14);
doc.setTextColor(0);
doc.text(`Total Final: $${totalFinal.toFixed(2)} MXN`, 14, currentY);
currentY += 14;

// --- 5. Pie de página institucional ---
doc.setFontSize(8);
doc.setTextColor(150);
doc.text('RGE - México | Calidad y Precisión en Aluminio, Carpintería y Herrería.', 14, currentY);

      doc.save(`Cotizacion_${nombreCliente.replace(/\s+/g, '_')}.pdf`);
      setVista('exito');

    } catch (error) {
      console.error('Error al generar la cotización:', error);
      alert('Hubo un error al guardar o generar la cotización.');
    } finally {
      setCargando(false);
    }
  };

  const productosFiltrados = productos.filter(p => 
    p.name.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.sku.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Encabezado */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-slate-800 p-6 rounded-xl shadow-lg mb-6 border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">RGE - MÉXICO</h1>
            <p className="text-slate-400 text-sm">Sistema de Cotización y Catálogo Multinegocio</p>
          </div>
          {vista !== 'exito' && (
            <div className="mt-4 md:mt-0 flex items-center gap-3">
              <button 
                onClick={() => setVista('resumen')} 
                className="relative bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition"
              >
                <ShoppingCart size={18} />
                <span>Ver Cotización ({carrito.length})</span>
              </button>
            </div>
          )}
        </header>

        {/* Vista: Éxito / Opciones Post-Generación */}
        {vista === 'exito' ? (
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg text-center max-w-lg mx-auto space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 size={64} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">¡Cotización Generada y Guardada!</h2>
              <p className="text-slate-400 text-sm mt-2">El archivo PDF se ha descargado correctamente y los datos se guardaron en Supabase.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={reiniciarCotizacion}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition shadow"
              >
                <RotateCcw size={18} />
                <span>Nueva Cotización</span>
              </button>
              <button 
                onClick={() => setVista('inicio')}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition"
              >
                <Home size={18} />
                <span>Salir / Inicio</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Datos del Cliente */}
            <div className="bg-slate-800 p-4 rounded-xl shadow mb-6 border border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Nombre del Cliente</label>
                <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-3 py-2">
                  <User size={18} className="text-slate-400 mr-2" />
                  <input 
                    type="text" 
                    placeholder="Ej. Juan Pérez" 
                    value={nombreCliente} 
                    onChange={e => setNombreCliente(e.target.value)}
                    className="bg-transparent w-full focus:outline-none text-sm text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">WhatsApp / Teléfono</label>
                <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-3 py-2">
                  <Phone size={18} className="text-slate-400 mr-2" />
                  <input 
                    type="text" 
                    placeholder="Ej. 5512345678" 
                    value={telefonoCliente} 
                    onChange={e => setTelefonoCliente(e.target.value)}
                    className="bg-transparent w-full focus:outline-none text-sm text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Navegación de Vistas */}
            <div className="flex gap-3 mb-6">
              <button 
                onClick={() => setVista('catalogo')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 border transition ${vista === 'catalogo' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              >
                <Package size={18} />
                <span>Catálogo General</span>
              </button>
              <button 
                onClick={() => setVista('cancelaria')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 border transition ${vista === 'cancelaria' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              >
                <Wrench size={18} />
                <span>Cancelería / Medidas</span>
              </button>
            </div>

            {/* Vista: Catálogo General */}
            {vista === 'catalogo' && (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-slate-200">Seleccionar Productos</h2>
                  <div className="relative w-64">
                    <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar producto..." 
                      value={busqueda} 
                      onChange={e => setBusqueda(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {productosFiltrados.map(prod => (
                    <div key={prod.id} className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex flex-col justify-between">
                      <div>
                        <span className="text-xs text-blue-400 font-mono">SKU: {prod.sku}</span>
                        <h3 className="font-semibold text-slate-100 mt-1">{prod.name}</h3>
                        <p className="text-lg font-bold text-emerald-400 mt-2">${prod.sale_price.toFixed(2)} MXN</p>
                      </div>
                      <button 
                        onClick={() => agregarCatalogoAlCarrito(prod)}
                        className="mt-4 bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition"
                      >
                        <Plus size={16} /> Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vista: Cancelería / Medidas */}
            {vista === 'cancelaria' && (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg max-w-xl mx-auto">
                <h2 className="text-lg font-semibold text-slate-200 mb-4">Cotizador por Conceptos (m²)</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Tipo de Obra / Sistema</label>
                    <select 
                      value={tipoObra} 
                      onChange={e => setTipoObra(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value='Ventana 1F-1C 3"'>Ventana Fijo-Corrediza 3"</option>
                       <option value='Ventana 1C-1C 3"'>Ventana Doble Corrediza 3"</option>
                      <option value='Ventana 1F-1C 2"'>Ventana Fijo-Corrediza 2"</option>
                       <option value='Ventana 1C-1C 2"'>Ventana Doble Corrediza 2"</option>
                        <option value='Ventana 1C-1F-1C 3"'>Ventana Corrediza-Fijo-Corrediza 3"</option>
                       <option value='Ventana 1C-1F-1C 2"'>Ventana Corrediza-Fijo-Corrediza 2"</option>
                        <option value='Ventana 1F 3"'>Ventana Fija 3"</option>
                      <option value="Cancel de Baño Plástico">Cancel de Baño Plástico</option>
                      <option value="Puerta Abatible Aluminio">Puerta Abatible Aluminio</option>
                      <option value="Barandal de Cristal">Barandal de Cristal</option>
                    </select>
                  </div>
                  {/* - BLOQUE DEL PRECIO --- */}
<div>
  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">
    Precio x M² ($ MXN)
  </label>
  <input 
    type="number" 
    value={precioUnitarioInput}
    onChange={(e) => setPrecioUnitarioInput(e.target.value)}
    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
    placeholder="0.00"
  />
</div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Etiqueta / Ubicación (Ej. Ventana Recámara)</label>
                    <input 
                      type="text" 
                      placeholder="Identificador del espacio" 
                      value={etiquetaObra} 
                      onChange={e => setEtiquetaObra(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Ancho (metros)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={ancho} 
                        onChange={e => setAncho(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase">Alto (metros)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={alto} 
                        onChange={e => setAlto(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={agregarCancelariaAlCarrito}
                    
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition mt-4"
                  >
                    <Plus size={18} /> Agregar Concepto a la Cotización
                  </button>
                </div>
              </div>
            )}

            {/* Vista: Resumen y Carrito */}
            {vista === 'resumen' && (
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-slate-200">Resumen de Cotización</h2>
                  <button 
                    onClick={() => setVista('catalogo')}
                    className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <ArrowLeft size={16} /> Volver al catálogo
                  </button>
                </div>
                {carrito.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No hay elementos agregados en el carrito.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="divide-y divide-slate-700">
                      {carrito.map(item => (
                        <div key={item.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <h4 className="font-semibold text-slate-100">{item.nombre}</h4>
                            {item.tipo === 'cancelaria' && (
                              <p className="text-xs text-slate-400">
                                {item.etiqueta} — Medidas: {item.ancho}m x {item.alto}m ({item.area_total?.toFixed(2)} m²)
                              </p>
                            )}
                            <p className="text-sm text-emerald-400 font-medium">${item.subtotal.toFixed(2)} MXN</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.tipo === 'catalogo' && (
                              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg">
                                <button onClick={() => cambiarCantidad(item.id, -1)} className="p-1 text-slate-300 hover:text-white px-2"><Minus size={14} /></button>
                                <span className="text-sm px-2">{item.cantidad}</span>
                                <button onClick={() => cambiarCantidad(item.id, 1)} className="p-1 text-slate-300 hover:text-white px-2"><Plus size={14} /></button>
                              </div>
                            )}
                            <button onClick={() => eliminarItem(item.id)} className="text-rose-400 hover:text-rose-300 p-1">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-700 pt-4 mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Subtotal General:</span>
                       
                        <span className="font-bold text-slate-100">
  ${formatearMoneda(calcularSubtotalGeneral())} MXN
</span>
                   
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Costo de Flete / Instalación:</span>
                        <input 
                          type="number" 
                          value={flete} 
                          onChange={e => setFlete(Number(e.target.value))}
                          className="w-32 bg-slate-900 border border-slate-700 rounded p-1 text-right text-slate-100"
                        />
                      </div>
                      <div className="flex justify-between text-lg font-bold text-blue-400 pt-2 border-t border-slate-700">
                        <span>Total Final:</span>
                     
<span className="text-xl font-extrabold text-blue-400">
  ${formatearMoneda(calcularTotalFinal())} MXN
</span>

                      </div>
                    </div>
                    <button 
                      onClick={generarPDFyGuardar}
                      disabled={cargando}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition mt-6 shadow-lg"
                    >
                      <FileText size={20} />
                      <span>{cargando ? 'Generando y Guardando...' : 'Generar PDF y Guardar en Supabase'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}