import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TransactionItem } from '@/types';
import { TrashIcon, PencilIcon, PlusIcon, ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { getDateValidationError } from '@/utils/validators';

interface SimpleFormData {
  id?: string;
  tanggal: string;
  tipe: 'penerimaan' | 'pengeluaran';
  kategori: string;
  uraian: string;
  jumlah: string;
}

interface TransactionEditorProps {
  transactions: TransactionItem[];
  onSave: (transactions: TransactionItem[]) => void;
  accountName: string;
}

export const TransactionEditor = ({ transactions, onSave, accountName }: TransactionEditorProps) => {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  // Calculate running balance for transactions
  const transactionsWithRunningBalance = useMemo(() => {
    let runningBalance = 0;
    return transactions.map(tx => {
      const penerimaan = Object.values(tx.penerimaan || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
      const pengeluaran = Object.values(tx.pengeluaran || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
      const jumlah = penerimaan - pengeluaran;
      runningBalance += jumlah;
      return {
        ...tx,
        jumlah,
        saldo_berjalan: runningBalance
      };
    });
  }, [transactions]);

  const [editedTransactions, setEditedTransactions] = useState<TransactionItem[]>(transactionsWithRunningBalance);
  const [simpleForm, setSimpleForm] = useState<SimpleFormData>({
    tanggal: new Date().toISOString().split('T')[0],
    tipe: 'penerimaan',
    kategori: '',
    uraian: '',
    jumlah: '0'
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({ 
    isOpen: false, 
    id: null 
  });

  // Extract unique categories from existing transactions
  const existingCategories = useMemo(() => {
    const categories = new Set<string>();
    
    editedTransactions.forEach(tx => {
      Object.keys(tx.penerimaan || {}).forEach(cat => categories.add(cat));
      Object.keys(tx.pengeluaran || {}).forEach(cat => categories.add(cat));
    });
    
    return Array.from(categories).sort();
  }, [editedTransactions]);

  // Update local state when transactions prop changes
  useEffect(() => {
    let runningBalance = 0;
    const updatedTransactions = transactions.map(tx => {
      const penerimaan = Object.values(tx.penerimaan || {}).reduce((sum: number, val) => sum + (Number(val) || 0), 0);
      const pengeluaran = Object.values(tx.pengeluaran || {}).reduce((sum: number, val) => sum + (Number(val) || 0), 0);
      const jumlah = penerimaan - pengeluaran;
      runningBalance += jumlah;
      return {
        ...tx,
        jumlah,
        saldo_berjalan: runningBalance
      };
    });
    setEditedTransactions(updatedTransactions);
  }, [transactions]);


  // Handles opening the delete confirmation dialog
  const confirmDeleteClick = useCallback((id: string): void => {
    setDeleteConfirm({ isOpen: true, id });
  }, []);

  const formRef = useRef<HTMLDivElement>(null);

  const handleEdit = useCallback((id: string) => {
    const transaction = editedTransactions.find(tx => tx.id === id) as TransactionItem | undefined;
    if (transaction) {
      // Get the first category from either penerimaan or pengeluaran
      const firstCategory = Object.keys(transaction.penerimaan || {})[0] || 
                          Object.keys(transaction.pengeluaran || {})[0] || '';
      
      // Get the amount from the first category
      const amount = (transaction.penerimaan?.[firstCategory] || 
                     transaction.pengeluaran?.[firstCategory] || 0).toString();
      
      // Determine the type based on which object has values
      const type = Object.keys(transaction.penerimaan || {}).length > 0 ? 'penerimaan' : 'pengeluaran';
      
      setSimpleForm({
        id: transaction.id,
        tanggal: transaction.tanggal,
        tipe: type,
        kategori: firstCategory,
        uraian: transaction.uraian || '',
        jumlah: amount,
      });
      
      setEditingId(id);
      setIsAdding(true);
      
      // Add visual feedback by highlighting the row
      const row = document.getElementById(`transaction-${id}`);
      if (row) {
        row.classList.add('bg-blue-50');
        setTimeout(() => {
          row.classList.remove('bg-blue-50');
        }, 2000);
      }
      
      // Scroll to form with smooth behavior
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [editedTransactions]);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm.id) return;
    
    const updated = editedTransactions.filter(t => t.id !== deleteConfirm.id);
    setEditedTransactions(updated);
    onSave(updated);
    setDeleteConfirm({ isOpen: false, id: null });
    toast.success('Transaksi berhasil dihapus');
  }, [deleteConfirm.id, editedTransactions, onSave]);

  // Handle input change for simple form
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Clear any existing error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // For amount field, keep only numbers
    if (name === 'jumlah') {
      const numericValue = value.replace(/\D/g, '');
      setSimpleForm(prev => ({
        ...prev,
        [name]: numericValue
      }));
    } else {
      setSimpleForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }, [errors]);

  // Handle date input with validation
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const error = getDateValidationError(value);
    
    setSimpleForm(prev => ({
      ...prev,
      tanggal: value
    }));
    
    if (error) {
      setErrors(prev => ({
        ...prev,
        tanggal: error
      }));
    } else if (errors.tanggal) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.tanggal;
        return newErrors;
      });
    }
  }, [errors.tanggal]);

  // Format currency for display
  const formatCurrency = useCallback((value: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }, []);


  const handleSaveTransaction = useCallback((e: React.FormEvent): void => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});
    
    const newErrors: Record<string, string> = {};
    
    if (!simpleForm.tanggal) {
      newErrors.tanggal = 'Tanggal harus diisi';
    }
    
    if (!simpleForm.kategori) {
      newErrors.kategori = 'Kategori harus dipilih';
    }
    
    if (!simpleForm.uraian) {
      newErrors.uraian = 'Uraian harus diisi';
    }
    
    if (isNaN(Number(simpleForm.jumlah)) || Number(simpleForm.jumlah) <= 0) {
      newErrors.jumlah = 'Jumlah harus lebih dari 0';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Terdapat kesalahan pada form. Silakan periksa kembali.');
      return;
    }

    const txData: Omit<TransactionItem, 'id'> = {
      tanggal: simpleForm.tanggal,
      uraian: simpleForm.uraian,
      penerimaan: {},
      pengeluaran: {},
      jumlah: 0,
      saldo_berjalan: 0
    };

    if (simpleForm.tipe === 'penerimaan') {
      txData.penerimaan = { [simpleForm.kategori]: Number(simpleForm.jumlah) };
    } else {
      txData.pengeluaran = { [simpleForm.kategori]: Number(simpleForm.jumlah) };
    }

    const penerimaanTotal = Object.values(txData.penerimaan).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const pengeluaranTotal = Object.values(txData.pengeluaran).reduce((sum, val) => sum + (Number(val) || 0), 0);
    txData.jumlah = penerimaanTotal - pengeluaranTotal;

    let updated: TransactionItem[];
    if (editingId) {
      // Update existing transaction
      const updatedTransaction = editedTransactions.find(tx => tx.id === editingId);
      if (updatedTransaction) {
        // Calculate jumlah for the new transaction
        const penerimaanTotal = Object.values(updatedTransaction.penerimaan).reduce(
          (sum, val) => sum + (Number(val) || 0),
          0
        );
        const pengeluaranTotal = Object.values(updatedTransaction.pengeluaran).reduce(
          (sum, val) => sum + (Number(val) || 0),
          0
        );
        updatedTransaction.jumlah = penerimaanTotal - pengeluaranTotal;

        updated = editedTransactions.map(tx => 
          tx.id === editingId ? { ...updatedTransaction, ...txData } : tx
        );
      } else {
        updated = editedTransactions;
      }
    } else {
      // Add new transaction
      const newTx: TransactionItem = {
        ...txData,
        id: `tx-${Date.now()}`
      };
      updated = [...editedTransactions, newTx];
    }

    setEditedTransactions(updated);
    onSave(updated);
    
    // Reset the form
    setSimpleForm({
      tanggal: new Date().toISOString().split('T')[0],
      uraian: '',
      jumlah: '',
      tipe: 'penerimaan',
      kategori: ''
    });
    
    setIsAdding(false);
    setEditingId(null);
  }, [simpleForm, editingId, editedTransactions, onSave]);

  // Add scroll to form with smooth behavior
  useEffect(() => {
    if (isAdding && formRef.current) {
      // Small delay to ensure the form is rendered
      const timer = setTimeout(() => {
        formRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'start'
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isAdding, editingId]);

  // Render the transaction list
  const renderTransactionList = (): JSX.Element => (
    <div className="overflow-x-auto bg-white shadow-sm rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tanggal
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Uraian
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Kategori
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Jumlah
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Saldo Berjalan
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {editedTransactions.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center">
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-700">Tidak ada transaksi</h3>
                  <p className="mt-1 text-sm text-gray-500">Mulai dengan menambahkan transaksi pertama Anda.</p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdding(true);
                        setSimpleForm({
                          tanggal: new Date().toISOString().split('T')[0],
                          uraian: '',
                          jumlah: '',
                          tipe: 'penerimaan',
                          kategori: ''
                        });
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PlusIcon className="-ml-1 mr-2 h-4 w-4" />
                      Tambah Transaksi
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            editedTransactions.map((transaction) => {
              const isPenerimaan = Object.keys(transaction.penerimaan || {}).length > 0;
              const category = isPenerimaan 
                ? Object.keys(transaction.penerimaan || {})[0] 
                : Object.keys(transaction.pengeluaran || {})[0];
              const amount = isPenerimaan 
                ? Object.values(transaction.penerimaan || {})[0] 
                : Object.values(transaction.pengeluaran || {})[0];
              
              return (
                <tr 
                  id={`transaction-${transaction.id}`}
                  key={transaction.id} 
                  className={`hover:bg-gray-50 transition-all duration-300 ${
                    editingId === transaction.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(transaction.tanggal).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(transaction.tanggal).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">
                      {transaction.uraian || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      isPenerimaan 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {category || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className={`text-sm font-medium ${
                      isPenerimaan ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isPenerimaan ? '' : '-'}{formatCurrency(amount?.toString() || '0')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(transaction.saldo_berjalan?.toString() || '0')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(transaction.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                        title="Edit transaksi"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDeleteClick(transaction.id)}
                        className="text-red-600 hover:text-red-900 transition-colors duration-200"
                        title="Hapus transaksi"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  // Render the transaction form
  const renderTransactionForm = (): JSX.Element => (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            {editingId ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {editingId ? 'Perbarui detail transaksi' : 'Masukkan detail transaksi baru'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAdding(false);
            setEditingId(null);
            setErrors({});
          }}
          className="text-gray-400 hover:text-gray-500 transition-colors duration-200"
          aria-label="Tutup form"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
      
      <form onSubmit={handleSaveTransaction} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Tanggal */}
          <div className="space-y-1">
            <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700">
              Tanggal <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                name="tanggal"
                id="tanggal"
                value={simpleForm.tanggal}
                onChange={handleDateChange}
                className={`block w-full rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:ring-2 focus:ring-opacity-50 ${
                  errors.tanggal 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
              />
            </div>
            {errors.tanggal && (
              <p className="mt-1 text-sm text-red-600">{errors.tanggal}</p>
            )}
          </div>

          {/* Jenis Transaksi */}
          <div className="space-y-1">
            <label htmlFor="tipe" className="block text-sm font-medium text-gray-700">
              Jenis Transaksi <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="tipe"
                name="tipe"
                value={simpleForm.tipe}
                onChange={handleInputChange}
                className="block w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                <option value="penerimaan" className="text-green-600">Penerimaan</option>
                <option value="pengeluaran" className="text-red-600">Pengeluaran</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Kategori */}
        <div className="space-y-1">
          <label htmlFor="kategori" className="block text-sm font-medium text-gray-700">
            Kategori <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              name="kategori"
              id="kategori"
              list="kategori-list"
              value={simpleForm.kategori}
              onChange={handleInputChange}
              className={`block w-full rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:ring-2 focus:ring-opacity-50 ${
                errors.kategori 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
              placeholder="Contoh: Gaji, Belanja, dll"
              autoComplete="off"
            />
            <datalist id="kategori-list">
              {existingCategories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            {existingCategories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {existingCategories.slice(0, 5).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setSimpleForm(prev => ({
                        ...prev,
                        kategori: category
                      }));
                      if (errors.kategori) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.kategori;
                          return newErrors;
                        });
                      }
                    }}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors duration-200"
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>
          {errors.kategori && (
            <p className="mt-1 text-sm text-red-600">{errors.kategori}</p>
          )}
        </div>

        {/* Uraian */}
        <div className="space-y-1">
          <label htmlFor="uraian" className="block text-sm font-medium text-gray-700">
            Uraian <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="uraian"
            id="uraian"
            value={simpleForm.uraian}
            onChange={handleInputChange}
            className={`block w-full rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-all duration-200 focus:ring-2 focus:ring-opacity-50 ${
              errors.uraian 
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
            }`}
            placeholder="Deskripsi singkat transaksi"
          />
          {errors.uraian && (
            <p className="mt-1 text-sm text-red-600">{errors.uraian}</p>
          )}
        </div>

        {/* Jumlah */}
        <div className="space-y-1">
          <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700">
            Jumlah (Rp) <span className="text-red-500">*</span>
          </label>
          <div className="space-y-1">
            <div className="relative group">
              <div className={`flex items-center rounded-lg border px-3 py-2.5 shadow-sm transition-all duration-200 ${
                errors.jumlah 
                  ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-200' 
                  : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 group-hover:border-blue-400'
              }`}>
                <span className={`text-gray-500 transition-colors duration-200 ${
                  errors.jumlah ? 'text-red-500' : 'group-hover:text-blue-600'
                }`}>Rp</span>
                <input
                  type="text"
                  name="jumlah"
                  id="jumlah"
                  value={simpleForm.jumlah}
                  onChange={handleInputChange}
                  className="ml-1 w-full border-none p-0 text-gray-900 outline-none focus:ring-0 bg-transparent"
                  placeholder="0"
                  inputMode="numeric"
                  aria-invalid={!!errors.jumlah}
                />
              </div>
              {simpleForm.jumlah && (
                <div className="text-sm text-gray-500 mt-1">
                  Jumlah: Rp {formatCurrency(simpleForm.jumlah)}
                </div>
              )}
            </div>
          {errors.jumlah && (
            <p className="mt-1 text-sm text-red-600">{errors.jumlah}</p>
          )}
          </div>
        </div>

        <div className="pt-2 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setEditingId(null);
              setErrors({});
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Batal
          </button>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            {editingId ? 'Perbarui' : 'Tambah'} Transaksi
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Daftar Transaksi</h2>
          <p className="text-sm text-gray-500">Kelola transaksi untuk akun: {accountName}</p>
        </div>
        <div className="flex items-center space-x-3">
          {!isAdding && (
            <button
              type="button"
              onClick={() => {
                setIsAdding(true);
                setSimpleForm({
                  tanggal: new Date().toISOString().split('T')[0],
                  uraian: '',
                  jumlah: '',
                  tipe: 'penerimaan',
                  kategori: ''
                });
                setEditingId(null);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="-ml-1 mr-2 h-4 w-4" />
              Tambah Transaksi
            </button>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Transaksi"
        message="Apakah Anda yakin ingin menghapus transaksi ini?"
        confirmText="Hapus"
        cancelText="Batal"
      />

      {isAdding && (
        <div 
          ref={formRef} 
          className="mb-6 transition-all duration-300 ease-in-out transform hover:shadow-lg border-l-4 border-blue-500 pl-4 bg-blue-50/30 rounded-r-lg"
          style={{ scrollMarginTop: '20px' }}
        >
          {renderTransactionForm()}
        </div>
      )}

      {editedTransactions.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">
              Daftar Transaksi {isAdding && '(Scroll ke bawah untuk melihat semua)'}
            </h3>
            {isAdding && (
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Sembunyikan Form
              </button>
            )}
          </div>
          {renderTransactionList()}
        </div>
      )}

      {editedTransactions.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow border border-gray-100 transition-all duration-200 hover:shadow-md">
          <div className="text-sm text-gray-600">
            Total <span className="font-medium">{editedTransactions.length}</span> transaksi
          </div>
          <button
            type="button"
            onClick={() => {
              navigate('/reports', { 
                state: { 
                  accountData: {
                    name: accountName,
                    transactions: editedTransactions
                  }
                } 
              });
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ChartBarIcon className="-ml-1 mr-2 h-4 w-4" />
            Lihat Laporan
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionEditor;