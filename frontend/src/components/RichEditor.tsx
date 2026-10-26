import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { api } from '@/api/client';
import { useToast, errorMessage } from './ui';

/** Trình soạn thảo rich text (SRS 01: TipTap). HTML được backend làm sạch khi lưu. */
export function RichEditor({ value, onChange, small, placeholder }: { value: string; onChange: (html: string) => void; small?: boolean; placeholder?: string }) {
  const toast = useToast();
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Image, Youtube.configure({ nocookie: true, width: 640, height: 360 })],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    editorProps: { attributes: { 'aria-label': placeholder ?? 'Nội dung' } },
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(value === '' && editor.isEmpty)) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);
  if (!editor) return null;

  const btn = (label: string, run: () => void, active?: boolean, title?: string) => (
    <button type="button" className={active ? 'on' : ''} onClick={run} title={title ?? label} aria-label={title ?? label}>
      {label}
    </button>
  );
  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const form = new FormData();
      form.append('file', f);
      try {
        const r = await api<{ url: string }>('/admin/files?purpose=LESSON_CONTENT', { method: 'POST', form });
        editor.chain().focus().setImage({ src: r.url }).run();
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    };
    input.click();
  };
  return (
    <div className={`rte${small ? ' sm' : ''}`}>
      <div className="tb">
        {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'In đậm')}
        {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'In nghiêng')}
        {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Tiêu đề')}
        {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), 'Tiêu đề nhỏ')}
        {btn('• Danh sách', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('1. Danh sách', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {btn('Trích dẫn', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
        {btn(
          'Liên kết',
          () => {
            const url = window.prompt('Địa chỉ liên kết (https://...)', editor.getAttributes('link').href ?? 'https://');
            if (url === null) return;
            if (!url) editor.chain().focus().unsetLink().run();
            else editor.chain().focus().setLink({ href: url }).run();
          },
          editor.isActive('link'),
        )}
        {!small && btn('Ảnh', addImage)}
        {!small &&
          btn('Video', () => {
            const url = window.prompt('Đường dẫn YouTube');
            if (url) editor.commands.setYoutubeVideo({ src: url });
          })}
        {btn('↶', () => editor.chain().focus().undo().run(), false, 'Hoàn tác')}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Tải tệp qua API quản trị (FR-ADM-23). */
export async function uploadFile(file: File, purpose: string) {
  const form = new FormData();
  form.append('file', file);
  return api<{ id: number; url: string; originalName: string; contentType: string; sizeBytes: number }>(`/admin/files?purpose=${purpose}`, { method: 'POST', form });
}
