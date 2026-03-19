export type DeliveryTermRow = {
  id: number;
  delivery_name: string;
  delivery_description?: string;
  created_by?: number;
  created_at?: string;
  updated_by?: number;
  updated_at?: string;
};

export type DeliveryTermPayload = {
  delivery_name: string;
  delivery_description?: string;
  created_by?: number;
  updated_by?: number;
};
