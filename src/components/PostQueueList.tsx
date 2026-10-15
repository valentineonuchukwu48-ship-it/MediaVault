import React from 'react';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  CheckSquare,
  Square,
  Image as ImageIcon,
  ExternalLink,
  Edit3,
  Lock,
} from 'lucide-react';
import { FacebookPost } from '../types';

interface PostQueueListProps {
  posts: FacebookPost[];
  selectedIds: string[];
  activePostId: string | null;
  onSelectPost: (id: string) => void;
  onToggleSelectId: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDeletePost: (id: string) => void;
  onDuplicatePost: (post: FacebookPost) => void;
  onOpenEdit: (post: FacebookPost) => void;
}

export const PostQueueList: React.FC<PostQueueListProps> = ({
  posts,
  selectedIds,
  activePostId,
  onSelectPost,
  onToggleSelectId,
  onSelectAll,
  onDeselectAll,
  onMoveUp,
  onMoveDown,
  onDeletePost,
  onDuplicatePost,
  onOpenEdit,
}) => {
  const allSelected = posts.length > 0 && selectedIds.length === posts.length;

  if (posts.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Square className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h4 className="text-sm font-semibold text-slate-200">No Posts in Queue</h4>
        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
          Paste a Facebook post link above or click the example link to grab your first post.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Queue control bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 hover:text-white transition-colors font-medium"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {allSelected ? 'Deselect All' : 'Select All'} ({selectedIds.length}/{posts.length})
            </span>
          </button>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Total in deck: {posts.length}
        </span>
      </div>

      {/* Post cards list */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {posts.map((post, index) => {
          const isSelected = selectedIds.includes(post.id);
          const isActive = activePostId === post.id;

          return (
            <div
              key={post.id}
              onClick={() => onSelectPost(post.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                isActive
                  ? 'bg-slate-800/90 border-blue-500 shadow-md ring-1 ring-blue-500/30'
                  : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800/70 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Select Checkbox & Index */}
                <div
                  className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelectId(post.id);
                  }}
                >
                  <button
                    type="button"
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  <span className="text-[10px] font-mono font-semibold text-slate-400 tabular-nums">
                    #{index + 1}
                  </span>
                </div>

                {/* Thumbnail / Avatar */}
                <div className="w-11 h-11 rounded-lg bg-slate-900 border border-slate-700/80 overflow-hidden shrink-0 flex items-center justify-center relative">
                  {post.images && post.images.length > 0 ? (
                    <img
                      src={post.images[0]}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : post.authorAvatar ? (
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-sm font-bold text-slate-400">
                      {post.authorName.charAt(0) || 'F'}
                    </div>
                  )}

                  {post.images && post.images.length > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] font-mono text-white px-1 rounded">
                      +{post.images.length}
                    </span>
                  )}
                </div>

                {/* Content Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {post.authorName}
                      </span>
                      {post.isProtected && (
                        <span
                          title="Login-protected post: you can customize caption and photos"
                          className="flex items-center text-[10px] text-amber-400 font-mono"
                        >
                          <Lock className="w-2.5 h-2.5 mr-0.5" /> auth
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {post.postDate}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 leading-snug">
                    {post.postContent}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-mono">
                    <span>{post.likesCount} likes</span>
                    <span>·</span>
                    <span>{post.commentsCount} comments</span>
                    {post.images.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <ImageIcon className="w-2.5 h-2.5" />
                          {post.images.length} {post.images.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action buttons (Reorder, Edit, Delete) */}
                <div
                  className="flex flex-col items-center gap-1 shrink-0 ml-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMoveUp(index)}
                      className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-20 transition-colors"
                      title="Move Up in PDF"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === posts.length - 1}
                      onClick={() => onMoveDown(index)}
                      className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-20 transition-colors"
                      title="Move Down in PDF"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onOpenEdit(post)}
                      className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                      title="Edit Post Content"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicatePost(post)}
                      className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                      title="Duplicate Post"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePost(post.id)}
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      title="Remove from Deck"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
