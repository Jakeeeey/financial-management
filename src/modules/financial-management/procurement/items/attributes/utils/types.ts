export interface ItemAttribute {
  id: number;
  name: string;
  display_type: string;
  sort_order?: number;
  attribute_values?: ItemAttributeValue[];
}

export interface ItemAttributeValue {
  id: number;
  attribute_id: number;
  name: string;
  extra_price: number;
  sort_order?: number;
}
