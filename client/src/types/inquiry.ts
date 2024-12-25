import { Dispatch, SetStateAction } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { QtyIndicator } from '../hooks/useInquiryFilters';

export type DeleteType = 'reference' | 'supplier-response' | 'item';

export interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  type: DeleteType | null;
  error: string | null;
}

export interface Statistics {
  unique_items: number;
  suppliers_responded: number;
  total_suppliers: number;
  days_active: number;
  response_rate: number;
}

export interface PriceUpdateData {
  price: number;
  is_permanent: boolean;
  notes?: string;
  item_id: string;
}

export interface SupplierResponse {
  supplier_id?: string;
  supplier_name: string;
  price_quoted: number;
  response_date: Date;
  status: string;
  is_promotion: boolean;
  is_permanent?: boolean;
  promotion_name?: string;
  notes?: string;
}

export interface ReferenceChange {
  source: 'supplier' | 'user' | 'inquiry_item';
  supplier_name?: string;
  change_date: string;
  notes?: string;
  new_reference_id: string;
  changeId?: string;
}

export interface InquiryItem {
  inquiryItemID: string;
  itemID: string;
  item_id: string;
  original_item_id: string;
  inquiryNumber?: string;
  customNumber?: string;
  hebrewDescription: string;
  englishDescription: string;
  importMarkup: number;
  hsCode: string;
  retailPrice: number;
  qtyInStock: number;
  requestedQty: number;
  referenceChange?: ReferenceChange;
  hasReferenceChange: boolean;
  isReferencedBy: boolean;
  isReplacement?: boolean;
  referencingItems: any[];
  status: string;
  date: string;
  excelRowIndex: number;
  isDuplicate: boolean;
  originalRowIndex: number | null;
  promotionId: string | null;
  promotionName: string;
  promotionPrice: number | null;
  promotionStartDate: string | null;
  promotionEndDate: string | null;
  supplierResponses: SupplierResponse[];
  supplierResponseId?: string;
}

export interface InquiryHeaderProps {
  inquiryStatus: string;
  inquiryDate: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  showDuplicates: boolean;
  onToggleDuplicates: () => void;
  showReplacements: boolean;
  onToggleReplacements: () => void;
  qtyIndicatorFilter: QtyIndicator | null;
  setQtyIndicatorFilter: Dispatch<SetStateAction<QtyIndicator | null>>;
  onUploadResponse: () => void;
  onViewBestPrices: () => void;
  onDeleteInquiry: () => void;
  onAddItem: () => void;
  error?: string | null;
  statistics?: Statistics;
}

export interface InquiryDialogStates {
  editingQty: string | null;
  setEditingQty: (id: string | null) => void;
  setDeleteConfirmOpen: (open: boolean) => void;
  setItemToDelete: (item: InquiryItem | null) => void;
  setSupplierUploadOpen: (open: boolean) => void;
  setDeleteInquiryConfirmOpen: (open: boolean) => void;
  handleAddItem: () => void;
  handleDeleteInquiry: (navigate: NavigateFunction) => Promise<void>;
  setAddItemDialogOpen: (open: boolean) => void;
  handleViewItemDetails: (item: InquiryItem) => void;
  handleEditItem: (item: InquiryItem) => void;
  resetDialogs: () => void;
  handleSaveItem: (data: FormData) => Promise<void>;
  getChangeSource: (reference_change: any) => string;
  addItemDialogOpen: boolean;
  deleteConfirmOpen: boolean;
  itemToDelete: InquiryItem | null;
  deleteInquiryConfirmOpen: boolean;
  supplierUploadOpen: boolean;
  error: string | null;
}

export interface InquiryHookResult {
  items: InquiryItem[];
  loading: boolean;
  error: string | null;
  inquiryStatus: string;
  inquiryDate: string;
  fetchItems: () => Promise<void>;
  handleUpdateQuantity: (itemId: string, newQty: number) => Promise<boolean>;
  handleDeleteItem: (item: InquiryItem) => Promise<boolean>;
  handleAddItem: (itemData: FormData) => Promise<boolean>;
  setError: (error: string | null) => void;
}

export interface InquiryFiltersResult {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showDuplicates: boolean;
  showReplacements: boolean;
  sortConfig: {
    field: string;
    direction: 'asc' | 'desc';
  };
  toggleDuplicates: () => void;
  toggleReplacements: () => void;
  handleSort: (field: string) => void;
  filteredAndSortedItems: InquiryItem[];
  qtyIndicatorFilter: QtyIndicator | null;
  setQtyIndicatorFilter: Dispatch<SetStateAction<QtyIndicator | null>>;
}

export interface TableHeaderProps {
  sortConfig: {
    field: string;
    direction: 'asc' | 'desc';
  };
  onSort: (field: string) => void;
  qtyIndicatorFilter: QtyIndicator | null;
  setQtyIndicatorFilter: Dispatch<SetStateAction<QtyIndicator | null>>;
}

export interface InquiryDialogsProps {
  dialogStates: InquiryDialogStates;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  onDelete: (target: 'inquiry' | InquiryItem) => Promise<boolean>;
  onUploadSuccess: () => void;
  inquiryId: string;
}

export interface ItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<boolean>;
  mode: 'add' | 'edit';
  item?: InquiryItem;
  error?: string | null;
}

export interface SupplierResponseListProps {
  inquiryId: string;
  totalExpectedItems: number;
}

export interface InquiryItemsTableProps {
  items: InquiryItem[];
  editingQty: string | null;
  onEditQty: (id: string | null, value?: string | null) => void;
  onUpdateQty: (itemId: string, newQty: number) => Promise<boolean>;
  onViewDetails: (item: InquiryItem) => void;
  onEditItem: (item: InquiryItem) => void;
  onDeleteItem: (item: InquiryItem) => void;
  sortConfig: {
    field: string;
    direction: 'asc' | 'desc';
  };
  onSort: (field: string) => void;
  onRefresh: () => void;
  getChangeSource: (reference_change: any) => string;
  qtyIndicatorFilter: QtyIndicator | null;
  setQtyIndicatorFilter: Dispatch<SetStateAction<QtyIndicator | null>>;
  onPriceUpdate?: (supplierId: string, priceData: PriceUpdateData) => Promise<boolean>;
}

export interface CustomTableRowProps {
  item: InquiryItem;
  index: number;
  editingQty: string | null;
  onEditQty: (id: string | null, value?: string | null) => void;
  onUpdateQty: (itemId: string, newQty: number) => Promise<boolean>;
  onViewDetails: (item: InquiryItem) => void;
  onEditItem: (item: InquiryItem) => void;
  onDeleteItem: (item: InquiryItem) => void;
  onDeleteReference: (item: InquiryItem) => void;
  getChangeSource: (reference_change: any) => string;
  onPriceUpdate: (supplierId: string, priceData: PriceUpdateData) => Promise<boolean>;
}

export interface PriceEditDialogProps {
  open: boolean;
  onClose: () => void;
  item: InquiryItem;
  supplierPrice: SupplierResponse;
  onSave: (priceData: PriceUpdateData) => Promise<void>;
}

export interface SupplierPriceChipProps {
  supplierPrice: SupplierResponse;
  item: InquiryItem;
  onPriceUpdate: (supplierId: string, priceData: PriceUpdateData) => Promise<boolean>;
}