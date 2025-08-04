import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './DiaryBrowser.css';
import axios from 'axios';
import { handleApiError, getAuthHeaders, checkAuthWithRedirect } from '../utils/auth';
import { exportDiaryToPDF, exportMultipleDiariesToPDF } from '../utils/pdfExport';

const DiaryBrowser = () => {
  const [diaries, setDiaries] = useState([]);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'timeline'
  const [dateFilter, setDateFilter] = useState({
    enabled: false,
    startDate: '',
    endDate: ''
  });
  const [showDateRange, setShowDateRange] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDiary, setEditingDiary] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sharingId, setSharingId] = useState(null);
  const [setShowAIDialog] = useState(false);
  const dateFilterRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  // AI对话相关状态
  const [aiChatMode] = useState('voice'); // 'text' or 'voice'
  const navigate = useNavigate();

  // Load conversations on component mount
  useEffect(() => {
    if (checkAuthWithRedirect()) {
      loadDiaries();
    }
  }, []);

  const loadDiaries = async () => {
    try {
      setIsLoading(true);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
        headers: getAuthHeaders()
      });
      
      setDiaries(response.data);
      setError('');
    } catch (error) {
      console.error('Error loading diaries:', error);
      handleApiError(error);
      setError('Failed to load diaries');
    } finally {
      setIsLoading(false);
    }
  };

  // Share to community function
  const shareToCommunity = async (diary, e) => {
    e.stopPropagation();
    setSharingId(diary.id);
    
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
        alert('Your diary has been shared to the community!');
      }
    } catch (error) {
      console.error('Error sharing diary to community:', error);
      // 如果API端点不存在，模拟成功分享
      if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
        console.warn('Community sharing API not available, simulating success');
        alert('Your diary has been shared to the community! (Note: Backend API is not available, this is a simulation)');
      } else {
        handleApiError(error);
        setError('Failed to share diary to community');
      }
    } finally {
      setSharingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Group diaries by date for timeline view
  const groupDiariesByDate = (diaries) => {
    const groups = {};
    diaries.forEach(diary => {
      const date = new Date(diary.date || diary.created_at);
      const dateKey = date.toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(diary);
    });
    return groups;
  };

  // Format date for timeline headers
  const formatTimelineDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const sortedDiaries = [...diaries].sort((a, b) => {
    const dateA = new Date(a.date || a.created_at);
    const dateB = new Date(b.date || b.created_at);
    return dateB - dateA; // Always newest first
  });

  // Filter diaries by date range if enabled
  const filteredDiaries = dateFilter.enabled 
    ? sortedDiaries.filter(diary => {
        const entryDate = new Date(diary.date || diary.created_at);
        const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
        const endDate = dateFilter.endDate ? new Date(dateFilter.endDate + 'T23:59:59') : null;
        
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      })
    : sortedDiaries;

  const handleDiaryClick = (diary) => {
    setSelectedDiary(diary);
  };

  const handleBackToList = () => {
    setSelectedDiary(null);
  };

  const deleteDiary = async (diaryId, e) => {
    e.stopPropagation(); // Prevent triggering diary click
    
    if (!window.confirm('Are you sure you want to delete this diary entry?')) {
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      await axios.delete(`${API_BASE_URL}/api/conversations/${diaryId}`, {
        headers: getAuthHeaders()
      });
      
      // Reload diaries
      loadDiaries();
      
      // If deleted diary was selected, clear selection
      if (selectedDiary?.id === diaryId) {
        setSelectedDiary(null);
      }
    } catch (error) {
      console.error('Error deleting diary:', error);
      handleApiError(error);
      setError('Failed to delete diary entry');
    }
  };

  // Handle date filter changes
  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleDateFilter = () => {
    setDateFilter(prev => ({
      ...prev,
      enabled: !prev.enabled,
      // Clear dates when disabling
      ...(prev.enabled && { startDate: '', endDate: '' })
    }));
    setShowDateRange(!dateFilter.enabled);
  };

  const clearDateFilter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    setDateFilter({
      enabled: false,
      startDate: '',
      endDate: ''
    });
    setShowDateRange(false);
  };

  // Handle mouse events for floating date range
  const handleDateFilterMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    if (dateFilter.enabled) {
      setShowDateRange(true);
    }
  };

  const handleDateFilterMouseLeave = (e) => {
    // Only hide on desktop - mobile will use overlay click
    if (window.innerWidth > 768) {
      // Use a timeout to prevent accidental hiding when moving between elements
      hideTimeoutRef.current = setTimeout(() => {
        setShowDateRange(false);
      }, 200);
    }
  };

  const handleDateRangeMouseEnter = () => {
    // Clear any pending hide timeout when mouse enters the inputs area
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowDateRange(true);
  };

  const handleDateRangeMouseLeave = () => {
    // Only hide on desktop when mouse leaves the entire date range area
    if (window.innerWidth > 768) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowDateRange(false);
      }, 200);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleOverlayClick = () => {
    setShowDateRange(false);
  };

  // PDF export functions
  const exportSingleDiary = async (diary, e) => {
    e.stopPropagation();
    setExportingId(diary.id);
    
    try {
      await exportDiaryToPDF(diary);
      setError('');
    } catch (error) {
      console.error('Error exporting diary to PDF:', error);
      setError('Failed to export diary to PDF');
    } finally {
      setExportingId(null);
    }
  };

  const exportAllDiaries = async () => {
    setIsExporting(true);
    
    try {
      await exportMultipleDiariesToPDF(filteredDiaries);
      setError('');
    } catch (error) {
      console.error('Error exporting all diaries to PDF:', error);
      setError('Failed to export all diaries to PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Edit functionality
  const startEditing = (diary) => {
    setIsEditing(true);
    setEditingDiary({
      id: diary.id,
      title: diary.title,
      content: diary.content,
      date: diary.date,
      created_at: diary.created_at,
      messages: diary.messages
    });
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingDiary(null);
  };

  const saveEdit = async () => {
    if (!editingDiary) return;

    setIsSaving(true);
    
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/conversations/${editingDiary.id}`,
        {
          title: editingDiary.title,
          content: editingDiary.content
        },
        {
          headers: getAuthHeaders()
        }
      );

      // Update the selected diary and diaries list
      const updatedDiary = response.data;
      setSelectedDiary(updatedDiary);
      setDiaries(prev => prev.map(d => d.id === updatedDiary.id ? updatedDiary : d));
      
      setIsEditing(false);
      setEditingDiary(null);
      setError('');
    } catch (error) {
      console.error('Error updating diary:', error);
      handleApiError(error);
      setError('Failed to update diary entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditChange = (field, value) => {
    setEditingDiary(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="diary-browser">
        <div className="loading">Loading your diary entries...</div>
      </div>
    );
  }

  return (
    <div className="diary-browser">
      {/* Overlay for mobile date range */}
      {dateFilter.enabled && showDateRange && (
        <div className="date-range-overlay" onClick={handleOverlayClick}></div>
      )}
      
      <div className="diary-header">
        <h2>My Diary</h2>
        <div className="header-controls">
          <div className="export-controls">
            <button 
              className="export-all-button"
              onClick={exportAllDiaries}
              disabled={isExporting || filteredDiaries.length === 0}
              title="Export all diaries to PDF"
            >
              {isExporting ? '📄 Exporting...' : '📄 Export All to PDF'}
            </button>
          </div>
          <div className="date-filter-controls" 
               ref={dateFilterRef}
               onMouseEnter={handleDateFilterMouseEnter}
               onMouseLeave={handleDateFilterMouseLeave}>
            <div className="filter-toggle">
              <label htmlFor="date-filter-enabled">
                <input 
                  type="checkbox"
                  id="date-filter-enabled"
                  checked={dateFilter.enabled}
                  onChange={toggleDateFilter}
                />
                <span className="filter-label">📅 Date Range Filter</span>
              </label>
            </div>
            {dateFilter.enabled && showDateRange && (
              <div className="date-range-inputs" 
                   onClick={(e) => e.stopPropagation()}
                   onMouseEnter={handleDateRangeMouseEnter}
                   onMouseLeave={handleDateRangeMouseLeave}>
                <div className="date-input-group">
                  <label htmlFor="start-date">From:</label>
                  <input
                    type="date"
                    id="start-date"
                    value={dateFilter.startDate}
                    onChange={(e) => handleDateFilterChange('startDate', e.target.value)}
                    className="date-input"
                  />
                </div>
                <div className="date-input-group">
                  <label htmlFor="end-date">To:</label>
                  <input
                    type="date"
                    id="end-date"
                    value={dateFilter.endDate}
                    onChange={(e) => handleDateFilterChange('endDate', e.target.value)}
                    className="date-input"
                  />
                </div>
                <button 
                  className="clear-filter-button"
                  onClick={clearDateFilter}
                  title="Clear date filter"
                >
                  ✖
                </button>
              </div>
            )}
          </div>
          <div className="view-controls">
            <label>View:</label>
            <div className="view-toggle">
              <button 
                className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                📋 List
              </button>
              <button 
                className={`view-button ${viewMode === 'timeline' ? 'active' : ''}`}
                onClick={() => setViewMode('timeline')}
              >
                📅 Timeline
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {diaries.length > 0 && (
        <div className="diary-stats">
          <span className="stats-text">
            {dateFilter.enabled 
              ? `${filteredDiaries.length} of ${diaries.length} diary ${filteredDiaries.length === 1 ? 'entry' : 'entries'} in selected date range`
              : `${diaries.length} diary ${diaries.length === 1 ? 'entry' : 'entries'} total`
            }
          </span>
          {dateFilter.enabled && (dateFilter.startDate || dateFilter.endDate) && (
            <span className="filter-info">
              {dateFilter.startDate && dateFilter.endDate 
                ? ` (${new Date(dateFilter.startDate).toLocaleDateString()} - ${new Date(dateFilter.endDate).toLocaleDateString()})`
                : dateFilter.startDate 
                  ? ` (from ${new Date(dateFilter.startDate).toLocaleDateString()})`
                  : ` (until ${new Date(dateFilter.endDate).toLocaleDateString()})`
              }
            </span>
          )}
        </div>
      )}

      {!selectedDiary ? (
        <div className="diary-list">
          {filteredDiaries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📔</div>
              {dateFilter.enabled ? (
                <>
                  <h3>No diary entries found</h3>
                  <p>No diary entries match the selected date range. Try adjusting your date filter or clear it to see all entries.</p>
                </>
              ) : (
                <>
                  <h3>No diary entries yet</h3>
                  <p>Start writing or speaking with Ora to create your first diary entry!</p>
                </>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <div className="diary-entries">
              {filteredDiaries.map(diary => (
                <div 
                  key={diary.id} 
                  className="diary-entry"
                  onClick={() => handleDiaryClick(diary)}
                >
                  <div className="entry-header">
                    <div className="entry-date">
                      <div className="date-badge">
                        {formatShortDate(diary.date || diary.created_at)}
                      </div>
                    </div>
                    <div className="entry-actions">
                      <button 
                        className="export-button"
                        onClick={(e) => exportSingleDiary(diary, e)}
                        disabled={exportingId === diary.id}
                        title="Export to PDF"
                      >
                        {exportingId === diary.id ? '📄...' : '📄'}
                      </button>
                      <button 
                        className="share-button"
                        onClick={(e) => shareToCommunity(diary, e)}
                        disabled={sharingId === diary.id}
                        title="Share to Community"
                      >
                        {sharingId === diary.id ? '🌍...' : '🌍'}
                      </button>
                      <button 
                        className="delete-button"
                        onClick={(e) => deleteDiary(diary.id, e)}
                        title="Delete diary entry"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="entry-content">
                    <h3 className="entry-title">{diary.title}</h3>
                    <p className="entry-preview">
                      {diary.content.length > 200 
                        ? diary.content.substring(0, 200) + '...'
                        : diary.content
                      }
                    </p>
                  </div>
                  <div className="entry-meta">
                    <span className="entry-time">
                      {formatDate(diary.date || diary.created_at)}
                    </span>
                    {diary.messages && diary.messages.length > 1 && (
                      <span className="chat-indicator">
                        💬 {diary.messages.length - 1} chat messages
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="timeline-view">
              {Object.entries(groupDiariesByDate(filteredDiaries))
                .sort(([dateA], [dateB]) => {
                  const dateObjA = new Date(dateA);
                  const dateObjB = new Date(dateB);
                  return dateObjB - dateObjA; // Always newest first
                })
                .map(([dateKey, dayDiaries]) => (
                  <div key={dateKey} className="timeline-day">
                    <div className="timeline-date-header">
                      <div className="date-marker"></div>
                      <h3 className="timeline-date">{formatTimelineDate(dateKey)}</h3>
                    </div>
                    <div className="timeline-entries">
                      {dayDiaries
                        .sort((a, b) => {
                          const timeA = new Date(a.date || a.created_at);
                          const timeB = new Date(b.date || b.created_at);
                          return timeB - timeA; // Always newest first
                        })
                        .map(diary => (
                          <div 
                            key={diary.id} 
                            className="timeline-entry"
                            onClick={() => handleDiaryClick(diary)}
                          >
                            <div className="timeline-marker">
                              <div className="timeline-dot"></div>
                              <div className="timeline-line"></div>
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-entry-header">
                                <div className="timeline-time">
                                  {new Date(diary.date || diary.created_at).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </div>
                                <div className="timeline-actions">
                                  <button 
                                    className="export-button timeline-export"
                                    onClick={(e) => exportSingleDiary(diary, e)}
                                    disabled={exportingId === diary.id}
                                    title="Export to PDF"
                                  >
                                    {exportingId === diary.id ? '📄...' : '📄'}
                                  </button>
                                  <button 
                                    className="delete-button timeline-delete"
                                    onClick={(e) => deleteDiary(diary.id, e)}
                                    title="Delete diary entry"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              <div className="timeline-entry-content">
                                <h4 className="timeline-title">{diary.title}</h4>
                                <p className="timeline-preview">
                                  {diary.content.length > 150 
                                    ? diary.content.substring(0, 150) + '...'
                                    : diary.content
                                  }
                                </p>
                                {diary.messages && diary.messages.length > 1 && (
                                  <div className="timeline-chat-indicator">
                                    💬 {diary.messages.length - 1} chat messages
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="diary-details">
          <div className="details-header">
            <button className="back-button" onClick={handleBackToList}>
              ← Back to List
            </button>
            <div className="diary-meta">
              <h2>{selectedDiary.title}</h2>
              <span className="diary-date">
                {formatDate(selectedDiary.date || selectedDiary.created_at)}
              </span>
            </div>
            <div className="detail-actions">
              <button 
                className="edit-button detail-edit"
                onClick={() => startEditing(selectedDiary)}
                disabled={isEditing}
                title="Edit diary entry"
              >
                {isEditing ? '✏️ Editing...' : '✏️ Edit'}
              </button>
              <button 
                className="export-button detail-export"
                onClick={(e) => exportSingleDiary(selectedDiary, e)}
                disabled={exportingId === selectedDiary.id}
                title="Export to PDF"
              >
                {exportingId === selectedDiary.id ? '📄 Exporting...' : '📄 Export PDF'}
              </button>
              <button 
                className="share-button detail-share"
                onClick={(e) => shareToCommunity(selectedDiary, e)}
                disabled={sharingId === selectedDiary.id}
                title="Share to Community"
              >
                {sharingId === selectedDiary.id ? '🌍 Sharing...' : '🌍 Share to Community'}
              </button>
            </div>
          </div>

          <div className="diary-content">
            {isEditing ? (
              <div className="edit-form">
                <div className="edit-field">
                  <label htmlFor="edit-title" className="edit-label">Title:</label>
                  <input
                    id="edit-title"
                    type="text"
                    value={editingDiary.title}
                    onChange={(e) => handleEditChange('title', e.target.value)}
                    className="edit-title-input"
                    placeholder="Enter diary title..."
                  />
                </div>
                
                <div className="edit-field">
                  <label htmlFor="edit-content" className="edit-label">Content:</label>
                  <textarea
                    id="edit-content"
                    value={editingDiary.content}
                    onChange={(e) => handleEditChange('content', e.target.value)}
                    className="edit-content-textarea"
                    placeholder="Write your diary content here..."
                    rows={15}
                  />
                </div>
                
                <div className="edit-actions">
                  <button 
                    className="save-edit-button"
                    onClick={saveEdit}
                    disabled={isSaving || !editingDiary.title.trim() || !editingDiary.content.trim()}
                  >
                    {isSaving ? '💾 Saving...' : '💾 Save Changes'}
                  </button>
                  <button 
                    className="cancel-edit-button"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="content-section">
                <div className="content-text">
                  {selectedDiary.content}
                </div>
              </div>
            )}

            {selectedDiary.messages && selectedDiary.messages.length > 1 && (
              <div className="chat-section">
                <h3>Chat History</h3>
                <div className="chat-messages">
                  {selectedDiary.messages
                    .filter(message => message.role !== 'system')
                    .map((message, index) => (
                    <div key={index} className={`chat-message ${message.role}`}>
                      <div className="message-role">
                        {message.role === 'user' ? 'You' : 'Ora'}
                      </div>
                      <div className="message-content">
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedDiary && (
            <div className="ai-dialog-entry">
              <button
                className="ai-dialog-btn"
                onClick={() => {
                  if (aiChatMode === 'voice') {
                    // 跳转到 WriteStory 页面，携带当前日记内容
                    navigate('/memories', {
                      state: {
                        diaryId: selectedDiary.id,
                        title: selectedDiary.title,
                        content: selectedDiary.content,
                        messages: selectedDiary.messages || []
                      }
                    });
                  } else {
                    setShowAIDialog(true);
                  }
                }}
              >
                🤖 AI语音对话
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiaryBrowser;
