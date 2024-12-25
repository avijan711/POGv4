import { Dispatch, SetStateAction } from 'react';
import { QtyIndicator } from '../../hooks/useInquiryFilters';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface TableHeaderProps {
  sortConfig: SortConfig;
  onSort: (field: string) => void;
  qtyIndicatorFilter: QtyIndicator | null;
  setQtyIndicatorFilter: Dispatch<SetStateAction<QtyIndicator | null>>;
}

export type DeleteType = 'reference' | 'supplier-response' | 'item';

export interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  type: DeleteType | null;
  error: string | null;
}

export interface ReferenceChange {
  source: 'supplier' | 'user' | 'inquiry_item';
  supplier_name?: string;
  change_date: string;
  notes?: string;
  new_reference_id: string;
  changeId?: string;
}

export interface InquiryItemWithReference {
  referenceChange?: ReferenceChange;
  isReplacement?: boolean;
}

export interface InquiryItem extends InquiryItemWithReference {
  inquiryItemID: string;
  itemID: string;
  inquiryNumber?: string;
  customNumber?: string;
  excelRowIndex?: number;
  originalRowIndex?: number;
  isDuplicate?: boolean;
  hasReferenceChange?: boolean;
  isReferencedBy?: boolean;
  hebrewDescription?: string;
  englishDescription?: string;
  importMarkup?: number;
  hsCode?: string;
  qtyInStock?: number;
  requestedQty?: number;
  retailPrice?: number;
  supplierResponseId?: string;
}

export interface CustomTableRowProps {
  item: InquiryItem;
  index: number;
  editingQty: string | null;
  onEditQty: (id: string | null, value?: string | null) => void;
  onUpdateQty: (id: string, qty: number) => Promise<boolean>;
  onViewDetails: (item: InquiryItem) => void;
  onEditItem: (item: InquiryItem) => void;
  onDeleteItem: (item: InquiryItem) => void;
  onDeleteReference: (item: InquiryItem) => void;
  getChangeSource: (reference_change: ReferenceChange) => string;
}