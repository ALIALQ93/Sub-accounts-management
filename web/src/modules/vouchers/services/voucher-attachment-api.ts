"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import {
  createVoucherAttachmentSignedUrl,
  deleteVoucherAttachmentFile,
  uploadVoucherAttachmentFile,
} from "@/lib/supabase/storage";
import type { VoucherAttachment } from "@/modules/vouchers/types";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfSupabaseError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message || "حدث خطأ غير متوقع من قاعدة البيانات.");
  }
}

export const voucherAttachmentApi = {
  async listByVoucherId(voucherId: string): Promise<VoucherAttachment[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("voucher_attachments")
      .select("*")
      .eq("voucher_id", voucherId)
      .order("created_at", { ascending: false });
    throwIfSupabaseError(error);
    return (data ?? []) as VoucherAttachment[];
  },

  async upload(voucherId: string, file: File): Promise<VoucherAttachment> {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { storagePath } = await uploadVoucherAttachmentFile(voucherId, file);

    const { data, error } = await supabase
      .from("voucher_attachments")
      .insert({
        voucher_id: voucherId,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: user?.id ?? null,
      })
      .select("*")
      .single();
    throwIfSupabaseError(error);

    return data as VoucherAttachment;
  },

  async remove(attachment: VoucherAttachment): Promise<void> {
    await deleteVoucherAttachmentFile(attachment.storage_path);

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("voucher_attachments")
      .delete()
      .eq("id", attachment.id);
    throwIfSupabaseError(error);
  },

  async getDownloadUrl(attachment: VoucherAttachment): Promise<string> {
    return createVoucherAttachmentSignedUrl(attachment.storage_path);
  },
};
