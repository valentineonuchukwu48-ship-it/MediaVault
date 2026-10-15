import React, { useState } from 'react';
import {
  X,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Globe,
  Users,
  Lock,
  MessageSquare,
  ThumbsUp,
  Share2,
  Image as ImageIcon,
} from 'lucide-react';
import { FacebookPost, FacebookComment } from '../types';

interface PostEditorProps {
  post: FacebookPost;
  onSave: (updated: FacebookPost) => void;
  onClose: () => void;
}

export const PostEditor: React.FC<PostEditorProps> = ({ post, onSave, onClose }) => {
  const [formData, setFormData] = useState<FacebookPost>({ ...post });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCommentAuthor, setNewCommentAuthor] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const result = loadEvt.target?.result as string;
        if (result) {
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, result],
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, newImageUrl.trim()],
    }));
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== index),
    }));
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const comment: FacebookComment = {
      id: `c_${Date.now()}`,
      author: newCommentAuthor.trim() || 'Facebook Friend',
      text: newCommentText.trim(),
      time: 'Just now',
      likes: 1,
    };
    setFormData((prev) => ({
      ...prev,
      comments: [...(prev.comments || []), comment],
      commentsCount: (prev.commentsCount || 0) + 1,
    }));
    setNewCommentAuthor('');
    setNewCommentText('');
  };

  const handleRemoveComment = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      comments: (prev.comments || []).filter((c) => c.id !== id),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">Edit Post Content & Metadata</span>
            <span className="text-xs font-mono text-slate-400">ID: {formData.id}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* Author Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Author Name
              </label>
              <input
                type="text"
                value={formData.authorName}
                onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Author Handle / Username
              </label>
              <input
                type="text"
                value={formData.authorHandle}
                onChange={(e) => setFormData({ ...formData, authorHandle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Date, Privacy & Verified */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Post Date & Time
              </label>
              <input
                type="text"
                value={formData.postDate}
                onChange={(e) => setFormData({ ...formData, postDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Privacy Setting
              </label>
              <select
                value={formData.privacy}
                onChange={(e) =>
                  setFormData({ ...formData, privacy: e.target.value as FacebookPost['privacy'] })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="public">Public (Globe)</option>
                <option value="friends">Friends Only</option>
                <option value="only_me">Only Me (Lock)</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={formData.isVerified ?? false}
                  onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
                />
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  Verified Badge
                </span>
              </label>
            </div>
          </div>

          {/* Post Caption / Text */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Post Caption / Content
            </label>
            <textarea
              rows={4}
              value={formData.postContent}
              onChange={(e) => setFormData({ ...formData, postContent: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
              placeholder="Write or edit the post caption..."
            />
          </div>

          {/* Photos Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Attached Photos ({formData.images.length})</span>
              </label>
              <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Local Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Thumbnail grid */}
            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                {formData.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700 bg-black"
                  >
                    <img
                      src={img}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add by image URL */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Or paste external image URL (https://...)"
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                disabled={!newImageUrl.trim()}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
              >
                Add URL
              </button>
            </div>
          </div>

          {/* Engagement Counters */}
          <div className="grid grid-cols-3 gap-4 p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-blue-400" /> Likes
              </label>
              <input
                type="number"
                min="0"
                value={formData.likesCount}
                onChange={(e) =>
                  setFormData({ ...formData, likesCount: parseInt(e.target.value) || 0 })
                }
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-emerald-400" /> Comments
              </label>
              <input
                type="number"
                min="0"
                value={formData.commentsCount}
                onChange={(e) =>
                  setFormData({ ...formData, commentsCount: parseInt(e.target.value) || 0 })
                }
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Share2 className="w-3 h-3 text-purple-400" /> Shares
              </label>
              <input
                type="number"
                min="0"
                value={formData.sharesCount}
                onChange={(e) =>
                  setFormData({ ...formData, sharesCount: parseInt(e.target.value) || 0 })
                }
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs font-mono"
              />
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-slate-300 block">
              Top Comments ({formData.comments?.length || 0})
            </label>

            {formData.comments && formData.comments.length > 0 && (
              <div className="space-y-2">
                {formData.comments.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-2 p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{c.author}: </span>
                      <span className="text-slate-300">{c.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveComment(c.id)}
                      className="text-slate-400 hover:text-red-400 p-1"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Commenter name"
                value={newCommentAuthor}
                onChange={(e) => setNewCommentAuthor(e.target.value)}
                className="w-1/3 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs"
              />
              <input
                type="text"
                placeholder="Comment text..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!newCommentText.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
