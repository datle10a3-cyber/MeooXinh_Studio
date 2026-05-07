"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardTitle } from "@/app/components/ui/card";

type DeleteConfirmationProps = {
  open: boolean;
  title?: string;
  description?: string;
  onHardDelete: () => void;
  onMoveToTrash: () => void;
  onCancel: () => void;
  hardLabel?: string;
  trashLabel?: string;
};

export function DeleteConfirmation({
  open,
  title = "Vui lòng lựa chọn",
  description = "Bạn muốn xử lý dữ liệu này như thế nào?",
  onHardDelete,
  onMoveToTrash,
  onCancel,
  hardLabel = "Xóa",
  trashLabel = "Chuyển vào thùng rác",
}: DeleteConfirmationProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#2F1E1A]/45 p-4 backdrop-blur-sm" onClick={onCancel}>
      <Card
        className="w-full max-w-md rounded-[2rem] border-[#F4C7C4] bg-white shadow-[0_24px_80px_rgba(91,52,44,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <p className="mt-2 whitespace-normal break-words text-sm font-semibold leading-6 text-[#9B746B]">
              {description}
            </p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#F4C7C4] bg-white text-[#5B342C] shadow-sm transition hover:bg-[#FFF3EC]"
            onClick={onCancel}
            aria-label="Không xóa"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <Button type="button" variant="danger" className="min-h-12 justify-center" onClick={onHardDelete}>
            <Trash2 size={17} />
            {hardLabel}
          </Button>
          <Button type="button" variant="secondary" className="min-h-12 justify-center" onClick={onMoveToTrash}>
            <Trash2 size={17} />
            {trashLabel}
          </Button>
          <Button type="button" variant="ghost" className="min-h-12 justify-center" onClick={onCancel}>
            Không xóa
          </Button>
        </div>
      </Card>
    </div>
  );
}
