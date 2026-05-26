"use client";

import { memo, useCallback, useEffect, useRef, useState, startTransition } from "react";
import {
  Copy, Eye, EyeOff, ExternalLink, Loader2, Pencil, Pin,
  Plus, Save, Search, StickyNote, Trash2, X,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input, Textarea } from "@/app/components/ui/input";
import { AlertModal } from "@/app/components/ui/alert-modal";
import { DeleteConfirmation } from "@/app/components/ui/delete-confirmation";
import { DetailModal } from "@/app/components/ui/detail-modal";
import { cn } from "@/app/utils/cn";
import { useUiStore } from "@/app/store/ui-store";
import { canCreate, canDelete, canMutate } from "@/app/types/auth";

type Note = {
  id: string;
  title: string;
  category?: string | null;
  username?: string | null;
  secret?: string | null;
  url?: string | null;
  content?: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type NoteForm = {
  title: string;
  category: string;
  username: string;
  secret: string;
  url: string;
  content: string;
  isPinned: string;
};

const emptyForm: NoteForm = { title: "", category: "", username: "", secret: "", url: "", content: "", isPinned: "false" };

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Tài khoản": { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-400" },
  "Khách hàng": { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", dot: "bg-sky-400" },
  "Vận hành": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-400" },
  "Tài chính": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-400" },
  "Nhân sự": { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-400" },
};

function getCategoryStyle(cat?: string | null) {
  if (!cat) return { bg: "bg-[#FFF0F4]", border: "border-[#F4C7C4]", text: "text-[#A84E61]", dot: "bg-[#EA7188]" };
  return CATEGORY_COLORS[cat] ?? { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600", dot: "bg-slate-400" };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr));
}

const NoteCard = memo(function NoteCard({
  note, onEdit, onDelete, onDetail, canEditNote, canDeleteNote,
}: {
  note: Note; onEdit: (n: Note) => void; onDelete: (n: Note) => void;
  onDetail: (n: Note) => void; canEditNote: boolean; canDeleteNote: boolean;
}) {
  const style = getCategoryStyle(note.category);
  const hasSecret = Boolean(note.secret);
  const hasUrl = Boolean(note.url);
  const hasUsername = Boolean(note.username);

  return (
    <button
      type="button"
      onClick={() => onDetail(note)}
      className={cn(
        "group relative flex w-full flex-col rounded-2xl border p-3.5 text-left transition-all sm:rounded-[1.35rem] sm:p-4",
        "hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] active:scale-[0.98]",
        style.bg, style.border,
        note.isPinned && "ring-2 ring-[#EA7188]/30",
      )}
    >
      {/* Pin badge */}
      {note.isPinned && (
        <div className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#EA7188] text-white shadow-md">
          <Pin size={12} className="rotate-45" />
        </div>
      )}

      {/* Category + time */}
      <div className="flex items-center gap-2">
        {note.category && (
          <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold", style.bg, style.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
            {note.category}
          </span>
        )}
        <span className="ml-auto text-[10px] font-medium text-slate-400">{timeAgo(note.updatedAt)}</span>
      </div>

      {/* Title */}
      <h3 className="mt-2 line-clamp-2 text-[15px] font-extrabold leading-snug text-[#3D2420] sm:text-base">
        {note.title || "Chưa có tiêu đề"}
      </h3>

      {/* Content preview */}
      {note.content && (
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[#7B554D]/80">
          {note.content}
        </p>
      )}

      {/* Tags row */}
      {(hasUsername || hasSecret || hasUrl) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {hasUsername && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
              👤 {note.username}
            </span>
          )}
          {hasSecret && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
              🔒 ••••••
            </span>
          )}
          {hasUrl && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-blue-500 ring-1 ring-blue-200">
              🔗 Link
            </span>
          )}
        </div>
      )}

      {/* Actions (visible on hover / always on mobile) */}
      {(canEditNote || canDeleteNote) && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-dashed border-slate-200/80 pt-2.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {canEditNote && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(note); }}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#5B342C] ring-1 ring-slate-200 transition hover:bg-[#FFF0F4] hover:ring-[#F4C7C4] active:scale-95"
            >
              <Pencil size={12} /> Sửa
            </button>
          )}
          {canDeleteNote && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(note); }}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-rose-500 ring-1 ring-rose-200 transition hover:bg-rose-50 active:scale-95"
            >
              <Trash2 size={12} /> Xóa
            </button>
          )}
        </div>
      )}
    </button>
  );
});

function NoteDetailView({ note, onClose, onEdit, canEditNote }: {
  note: Note; onClose: () => void; onEdit: (n: Note) => void; canEditNote: boolean;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const style = getCategoryStyle(note.category);

  return (
    <DetailModal
      onClose={onClose}
      maxWidth="max-w-lg"
      header={
        <div>
          <div className="flex items-center gap-2">
            {note.isPinned && <Pin size={14} className="text-[#EA7188]" />}
            {note.category && (
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", style.bg, style.text)}>
                {note.category}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-black text-[#3D2420]">{note.title}</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{timeAgo(note.updatedAt)}</p>
        </div>
      }
      footer={
        canEditNote ? (
          <Button className="w-full" onClick={() => { onClose(); onEdit(note); }}>
            <Pencil size={15} /> Chỉnh sửa ghi chú
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Username */}
        {note.username && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tài khoản</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#3D2420] break-all">{note.username}</p>
              <button type="button" onClick={() => copyText(note.username!, "username")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white hover:text-[#5B342C]">
                <Copy size={14} />
              </button>
            </div>
            {copied === "username" && <p className="mt-1 text-[11px] font-bold text-emerald-500">Đã copy ✓</p>}
          </div>
        )}

        {/* Secret */}
        {note.secret && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Mật khẩu / Mã</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#3D2420] break-all font-mono">
                {showSecret ? note.secret : "••••••••"}
              </p>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setShowSecret(!showSecret)}
                  className="grid h-8 w-8 place-items-center rounded-xl text-amber-500 transition hover:bg-white">
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button type="button" onClick={() => copyText(note.secret!, "secret")}
                  className="grid h-8 w-8 place-items-center rounded-xl text-amber-500 transition hover:bg-white">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            {copied === "secret" && <p className="mt-1 text-[11px] font-bold text-emerald-500">Đã copy ✓</p>}
          </div>
        )}

        {/* URL */}
        {note.url && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Link liên quan</p>
            <a href={note.url} target="_blank" rel="noopener noreferrer"
              className="mt-1 flex items-center gap-2 text-sm font-bold text-blue-600 break-all hover:underline">
              {note.url} <ExternalLink size={13} className="shrink-0" />
            </a>
          </div>
        )}

        {/* Content */}
        {note.content && (
          <div className="rounded-2xl border border-[#F4C7C4] bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#C87888]">Nội dung</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#5B342C]">{note.content}</p>
          </div>
        )}
      </div>
    </DetailModal>
  );
}

export function NotesView() {
  const session = useUiStore((s) => s.session);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [detailNote, setDetailNote] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState<NoteForm>(emptyForm);
  const [alertMsg, setAlertMsg] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/resources/notes?take=100");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      startTransition(() => setNotes(Array.isArray(data.data) ? data.data : []));
    } catch (err) {
      setAlertMsg("Không thể tải ghi chú: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchNotes(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchNotes]);

  const openCreate = () => {
    setEditingNote(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setForm({
      title: note.title || "",
      category: note.category || "",
      username: note.username || "",
      secret: note.secret || "",
      url: note.url || "",
      content: note.content || "",
      isPinned: note.isPinned ? "true" : "false",
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingNote(null); };

  const handleSave = async () => {
    if (!form.title.trim()) { setAlertMsg("Chưa nhập tiêu đề ghi chú."); return; }
    setSaving(true);
    try {
      const method = editingNote ? "PUT" : "POST";
      const body = editingNote ? { ...form, id: editingNote.id } : form;
      const res = await fetch("/api/resources/notes", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi lưu ghi chú");
      setAlertMsg(editingNote ? "Cập nhật ghi chú thành công!" : "Tạo ghi chú thành công!");
      closeForm();
      fetchNotes();
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mode: "hard" | "trash") => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/resources/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi xóa ghi chú");
      setAlertMsg("Đã xóa ghi chú thành công!");
      setDeleteTarget(null);
      fetchNotes();
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setDeleteLoading(false);
    }
  };

  const setField = (key: keyof NoteForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const filtered = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [n.title, n.category, n.username, n.content, n.url].some((v) => v?.toLowerCase().includes(q));
  });

  const pinned = filtered.filter((n) => n.isPinned);
  const unpinned = filtered.filter((n) => !n.isPinned);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#EA7188]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 -mx-1 bg-[#FFF8F5]/95 px-1 pb-3 pt-1 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B98278]" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Tìm ghi chú..."
                value={search}
                onChange={(e) => startTransition(() => setSearch(e.target.value))}
                className="h-11 w-full rounded-2xl border border-[#F1C5C1] bg-white pl-10 pr-4 text-sm font-semibold text-[#5B342C] outline-none transition placeholder:text-[#B98278] focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B98278]">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
          {canCreate(session) && (
            <Button onClick={openCreate} className="h-11 shrink-0 gap-1.5 rounded-2xl px-4 shadow-md">
              <Plus size={16} strokeWidth={3} /> <span className="hidden sm:inline">Thêm</span>
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-[#B98278]">
          {filtered.length} ghi chú {search && `· "${search}"`}
        </p>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="mt-16 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#FFF0F4]">
            <StickyNote size={32} className="text-[#EA7188]" />
          </div>
          <p className="mt-4 text-base font-black text-[#5B342C]">
            {search ? "Không tìm thấy ghi chú" : "Chưa có ghi chú nào"}
          </p>
          <p className="mt-1 text-sm font-medium text-[#9B746B]">
            {search ? "Thử từ khóa khác" : "Tạo ghi chú đầu tiên để lưu mật khẩu, tài khoản, hoặc lưu ý nội bộ."}
          </p>
        </div>
      )}

      {/* Pinned section */}
      {pinned.length > 0 && (
        <div className="mb-5">
          <div className="mb-2.5 flex items-center gap-2">
            <Pin size={13} className="text-[#EA7188]" />
            <span className="text-xs font-black uppercase tracking-wider text-[#C87888]">Đã ghim</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pinned.map((n) => (
              <NoteCard key={n.id} note={n} onEdit={openEdit} onDelete={setDeleteTarget}
                onDetail={setDetailNote} canEditNote={canMutate(session)} canDeleteNote={canDelete(session)} />
            ))}
          </div>
        </div>
      )}

      {/* All notes */}
      {unpinned.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <div className="mb-2.5 flex items-center gap-2">
              <StickyNote size={13} className="text-[#9B746B]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#9B746B]">Tất cả</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {unpinned.map((n) => (
              <NoteCard key={n.id} note={n} onEdit={openEdit} onDelete={setDeleteTarget}
                onDetail={setDetailNote} canEditNote={canMutate(session)} canDeleteNote={canDelete(session)} />
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailNote && (
        <NoteDetailView note={detailNote} onClose={() => setDetailNote(null)}
          onEdit={(n) => { setDetailNote(null); openEdit(n); }} canEditNote={canMutate(session)} />
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <DetailModal
          onClose={closeForm}
          maxWidth="max-w-lg"
          scrollKey={editingNote?.id ?? "new"}
          header={
            <h2 className="text-lg font-black text-[#3D2420]">
              {editingNote ? "Sửa ghi chú" : "Tạo ghi chú mới"}
            </h2>
          }
          footer={
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Đang lưu..." : "Lưu ghi chú"}
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#C87888]">Tiêu đề *</label>
              <Input placeholder="VD: Mật khẩu Canva, lưu ý khách VIP..." value={form.title} onChange={(e) => setField("title", e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#C87888]">Nhóm ghi chú</label>
              <Input placeholder="Tài khoản, khách hàng, vận hành..." value={form.category} onChange={(e) => setField("category", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#C87888]">Tài khoản</label>
                <Input placeholder="Tên đăng nhập" value={form.username} onChange={(e) => setField("username", e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#C87888]">Mật khẩu / Mã</label>
                <Input placeholder="Mật khẩu, mã PIN..." value={form.secret} onChange={(e) => setField("secret", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#C87888]">Link liên quan</label>
              <Input placeholder="https://..." value={form.url} onChange={(e) => setField("url", e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#C87888]">Ghim ghi chú</label>
              <select
                className="h-12 w-full rounded-2xl border border-[#F1C5C1] bg-[#FFF9F4] px-4 text-sm font-semibold text-[#5B342C] outline-none transition focus:border-[#EA7188] focus:ring-2 focus:ring-[#FFD4DF]"
                value={form.isPinned}
                onChange={(e) => setField("isPinned", e.target.value)}
              >
                <option value="false">Không ghim</option>
                <option value="true">Ghim lên đầu</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#C87888]">Nội dung</label>
              <Textarea placeholder="Ghi nội dung cần nhớ, hướng dẫn nội bộ..."
                value={form.content} onChange={(e) => setField("content", e.target.value)} className="min-h-32" />
            </div>
          </div>
        </DetailModal>
      )}

      {/* Delete confirmation */}
      <DeleteConfirmation
        open={Boolean(deleteTarget)}
        title={`Xóa "${deleteTarget?.title || ""}"?`}
        description="Bạn muốn xóa vĩnh viễn hay chuyển vào thùng rác?"
        onHardDelete={() => handleDelete("hard")}
        onMoveToTrash={() => handleDelete("trash")}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      {/* Alert */}
      <AlertModal isOpen={Boolean(alertMsg)} message={alertMsg} onClose={() => setAlertMsg("")} />
    </div>
  );
}
