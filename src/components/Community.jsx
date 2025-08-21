import React, { useState, useEffect } from 'react';
import './Community.css';
import axios from 'axios';
import { handleApiError, getAuthHeaders, checkAuthWithRedirect, getUserInfo } from '../utils/auth';
import { API_BASE_URL } from '../config/api';

const Community = ({ onReturn }) => {
  const [posts, setPosts] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('community'); // 'community' or 'my-posts'
  const [isLoading, setIsLoading] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    isPublic: true
  });
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [userDiaries, setUserDiaries] = useState([]);
  const [showDiarySelector, setShowDiarySelector] = useState(false);
  const [setSelectedDiary] = useState(null);

  // 获取社区帖子
  const fetchCommunityPosts = async () => {
    if (!checkAuthWithRedirect()) return;
    
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/community/posts`, {
        headers: getAuthHeaders()
      });
      setPosts(response.data.posts || []);
    } catch (error) {
      console.error('Error fetching community posts:', error);
      // 如果API端点不存在，使用模拟数据
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        console.warn('Community API not available, using mock data');
        setPosts([
          {
            id: 1,
            title: "Welcome to the Community!",
            content: "This is a sample community post. Once the backend API is implemented, you'll see real posts here.",
            author_name: "System",
            created_at: new Date().toISOString(),
            source_type: "system"
          }
        ]);
      } else {
        handleApiError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 获取用户自己的帖子
  const fetchUserPosts = async () => {
    if (!checkAuthWithRedirect()) return;
    
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/community/my-posts`, {
        headers: getAuthHeaders()
      });
      setUserPosts(response.data.posts || []);
    } catch (error) {
      console.error('Error fetching user posts:', error);
      // 如果API端点不存在，使用空数组
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        console.warn('User posts API not available');
        setUserPosts([]);
      } else {
        handleApiError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 获取用户的日记列表
  const fetchUserDiaries = async () => {
    if (!checkAuthWithRedirect()) return;
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
        headers: getAuthHeaders()
      });
      setUserDiaries(response.data.conversations || []);
    } catch (error) {
      console.error('Error fetching user diaries:', error);
      handleApiError(error);
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchCommunityPosts();
    fetchUserDiaries();
  }, []);

  // 切换标签时加载对应内容
  useEffect(() => {
    if (activeTab === 'my-posts') {
      fetchUserPosts();
    } else {
      fetchCommunityPosts();
    }
  }, [activeTab]);

  // 发布新帖子
  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!checkAuthWithRedirect()) return;
    
    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert('Please fill in both title and content');
      return;
    }
    
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/api/community/posts`, {
        title: newPost.title,
        content: newPost.content,
        isPublic: newPost.isPublic
      }, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setNewPost({ title: '', content: '', isPublic: true });
        setShowNewPostForm(false);
        // 刷新帖子列表
        if (activeTab === 'community') {
          fetchCommunityPosts();
        } else {
          fetchUserPosts();
        }
      }
    } catch (error) {
      console.error('Error creating post:', error);
      // 如果API端点不存在，模拟成功创建
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        console.warn('Post creation API not available, simulating success');
        const mockPost = {
          id: Date.now(),
          title: newPost.title,
          content: newPost.content,
          author_name: userInfo?.name || 'You',
          created_at: new Date().toISOString(),
          source_type: 'original',
          is_public: newPost.isPublic
        };
        
        if (activeTab === 'community' && newPost.isPublic) {
          setPosts(prev => [mockPost, ...prev]);
        } else {
          setUserPosts(prev => [mockPost, ...prev]);
        }
        
        setNewPost({ title: '', content: '', isPublic: true });
        setShowNewPostForm(false);
        alert('Post created successfully! (Note: Backend API is not available, this is a simulation)');
      } else {
        handleApiError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 从日记发布帖子
  const handlePostFromDiary = async (diary) => {
    if (!checkAuthWithRedirect()) return;
    
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/api/community/posts`, {
        title: diary.title,
        content: diary.content,
        isPublic: true,
        sourceType: 'diary',
        sourceId: diary.id
      }, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setShowDiarySelector(false);
        setSelectedDiary(null);
        // 刷新帖子列表
        if (activeTab === 'community') {
          fetchCommunityPosts();
        } else {
          fetchUserPosts();
        }
        alert('Your diary has been posted to the community!');
      }
    } catch (error) {
      console.error('Error posting diary:', error);
      // 如果API端点不存在，模拟成功分享
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        console.warn('Diary sharing API not available, simulating success');
        const mockPost = {
          id: Date.now(),
          title: diary.title,
          content: diary.content,
          author_name: userInfo?.name || 'You',
          created_at: new Date().toISOString(),
          source_type: 'diary',
          is_public: true
        };
        
        if (activeTab === 'community') {
          setPosts(prev => [mockPost, ...prev]);
        } else {
          setUserPosts(prev => [mockPost, ...prev]);
        }
        
        setShowDiarySelector(false);
        setSelectedDiary(null);
        alert('Your diary has been posted to the community! (Note: Backend API is not available, this is a simulation)');
      } else {
        handleApiError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 删除帖子
  const handleDeletePost = async (postId) => {
    if (!checkAuthWithRedirect()) return;
    
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    
    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      await axios.delete(`${API_BASE_URL}/api/community/posts/${postId}`, {
        headers: getAuthHeaders()
      });
      
      // 刷新帖子列表
      if (activeTab === 'community') {
        fetchCommunityPosts();
      } else {
        fetchUserPosts();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      // 如果API端点不存在，模拟删除成功
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        console.warn('Delete API not available, simulating success');
        if (activeTab === 'community') {
          setPosts(prev => prev.filter(post => post.id !== postId));
        } else {
          setUserPosts(prev => prev.filter(post => post.id !== postId));
        }
        alert('Post deleted successfully! (Note: Backend API is not available, this is a simulation)');
      } else {
        handleApiError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const userInfo = getUserInfo();

  return (
    <div className="community-container">
      <div className="community-header">
        <div className="header-content">
          <h1 className="community-title">Community</h1>
          <p className="community-subtitle">Share your stories and connect with others</p>
        </div>
        <button className="back-button" onClick={onReturn}>
          ← Back to Home
        </button>
      </div>

      <div className="community-nav">
        <button 
          className={`nav-tab ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => setActiveTab('community')}
        >
          📖 Community Posts
        </button>
        <button 
          className={`nav-tab ${activeTab === 'my-posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-posts')}
        >
          📝 My Posts
        </button>
      </div>

      {/* 新帖子表单 */}
      {showNewPostForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Post</h2>
              <button 
                className="close-button"
                onClick={() => setShowNewPostForm(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitPost} className="post-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="Enter post title..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="Share your thoughts..."
                  rows={8}
                  required
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newPost.isPublic}
                    onChange={(e) => setNewPost({ ...newPost, isPublic: e.target.checked })}
                  />
                  Make this post public
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowNewPostForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={isLoading}>
                  {isLoading ? 'Publishing...' : 'Publish Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 日记选择器 */}
      {showDiarySelector && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Share a Diary</h2>
              <button 
                className="close-button"
                onClick={() => setShowDiarySelector(false)}
              >
                ×
              </button>
            </div>
            <div className="diary-list">
              {userDiaries.length === 0 ? (
                <p className="no-diaries">No diaries found. Create some stories first!</p>
              ) : (
                userDiaries.map(diary => (
                  <div key={diary.id} className="diary-item">
                    <div className="diary-info">
                      <h3>{diary.title}</h3>
                      <p className="diary-date">{formatDate(diary.date)}</p>
                      <p className="diary-excerpt">
                        {diary.content.length > 150 
                          ? diary.content.substring(0, 150) + '...' 
                          : diary.content}
                      </p>
                    </div>
                    <button 
                      className="share-button"
                      onClick={() => handlePostFromDiary(diary)}
                      disabled={isLoading}
                    >
                      Share
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 帖子列表 */}
      <div className="posts-container">
        {isLoading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading posts...</p>
          </div>
        ) : (
          <>
            {activeTab === 'community' ? (
              posts.length === 0 ? (
                <div className="empty-state">
                  <p>No community posts yet. Be the first to share!</p>
                </div>
              ) : (
                <div className="posts-grid">
                  {posts.map(post => (
                    <div key={post.id} className="post-card">
                      <div className="post-header">
                        <h3 className="post-title">{post.title}</h3>
                        <div className="post-meta">
                          <span className="post-author">By {post.author_name}</span>
                          <span className="post-date">{formatDate(post.created_at)}</span>
                        </div>
                      </div>
                      <div className="post-content">
                        {post.content.length > 300 
                          ? post.content.substring(0, 300) + '...' 
                          : post.content}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              userPosts.length === 0 ? (
                <div className="empty-state">
                  <p>You haven't posted anything yet. Share your first story!</p>
                </div>
              ) : (
                <div className="posts-grid">
                  {userPosts.map(post => (
                    <div key={post.id} className="post-card user-post">
                      <div className="post-header">
                        <h3 className="post-title">{post.title}</h3>
                        <div className="post-meta">
                          <span className="post-date">{formatDate(post.created_at)}</span>
                          <button 
                            className="delete-button"
                            onClick={() => handleDeletePost(post.id)}
                            disabled={isLoading}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="post-content">
                        {post.content.length > 300 
                          ? post.content.substring(0, 300) + '...' 
                          : post.content}
                      </div>
                      <div className="post-footer">
                        <span className={`post-status ${post.is_public ? 'public' : 'private'}`}>
                          {post.is_public ? '🌍 Public' : '🔒 Private'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Community;
