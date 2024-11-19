export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

export const processResponses = (responses) => {
  if (!responses) return [];
  
  return responses.map(response => {
    const responseItems = (response.items || []).map(item => ({
      ...item,
      itemType: item.referenceChange ? 'reference' : 'response',
      itemKey: item.referenceChange ? `ref-${item.itemId}-${item.referenceChange.newReferenceID}` : `resp-${item.itemId}`,
      changeId: item.referenceChange?.changeId,
      newReferenceID: item.referenceChange?.newReferenceID
    }));

    const hasPromotionItems = responseItems.some(item => item.debugIsPromotion === 1);

    // Deduplicate missing items
    const missingItems = Array.from(
      new Map(
        JSON.parse(response.missingItems || '[]')
          .map(item => [item.itemId, item])
      ).values()
    );

    return {
      ...response,
      items: responseItems,
      itemCount: responseItems.length,
      extraItems: JSON.parse(response.extraItems || '[]'),
      replacements: JSON.parse(response.replacements || '[]'),
      missingItems,
      missingItemsCount: missingItems.length,
      isPromotion: hasPromotionItems
    };
  });
};
