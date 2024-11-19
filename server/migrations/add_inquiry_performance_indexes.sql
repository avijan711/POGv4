-- Add compound indexes for inquiry queries
CREATE INDEX IF NOT EXISTS idx_inquiry_item_inquiry_item ON InquiryItem(InquiryID, ItemID);
CREATE INDEX IF NOT EXISTS idx_supplier_response_item_status ON SupplierResponse(ItemID, Status);
CREATE INDEX IF NOT EXISTS idx_reference_change_original_supplier ON ItemReferenceChange(OriginalItemID, SupplierID);
CREATE INDEX IF NOT EXISTS idx_reference_change_new_original ON ItemReferenceChange(NewReferenceID, OriginalItemID);
