import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import './WriteStory.css';
import axios from 'axios';
import { getAccessToken, handleApiError, getAuthHeaders, checkAuthWithRedirect, getUserInfo } from '../utils/auth';
import VoiceActivityDetector from '../utils/voiceActivityDetector';
import { API_BASE_URL } from '../config/api';

const WriteStory = ({ onReturn }) => {
  // 保存初始diary内容用于对比
  const initialDiary = useRef({
    title: '',
    thoughts: '',
    messages: []
  });
  const location = useLocation();
  const [formData, setFormData] = useState({
    title: '',
    thoughts: ''
  });
  
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'system', content: 'I am an AI assistant that can help you create stories and memories.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pendingContent, setPendingContent] = useState(''); // 存储待保存的内容
  const [lastSavedTime, setLastSavedTime] = useState(null); // 记录最后保存时间
  const lastSavedTimeRef = useRef(null);
  
  // 语音相关状态
  const [chatMode, setChatMode] = useState('voice'); // 'text' or 'voice' - 默认为语音模式
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [vadState, setVadState] = useState({ isListening: false, isSpeaking: false });
  
  // 语音播放相关状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingMessage, setCurrentPlayingMessage] = useState(null);
  const audioRef = useRef(null);
  
  // VAD 实例
  const vadRef = useRef(null);
  
  // 使用 ref 跟踪录制状态，避免闭包问题
  const isRecordingRef = useRef(false);
  const isContinuousListeningRef = useRef(false);

  // 获取用户特定的草稿存储key
  const getDraftKey = () => {
    const userInfo = getUserInfo();
    if (!userInfo || !userInfo.id) {
      return null;
    }
    return `writeStoryDraft_user_${userInfo.id}`;
  };

  // 验证草稿是否属于当前用户
  const validateDraft = (draft) => {
    const userInfo = getUserInfo();
    if (!userInfo || !userInfo.id) {
      return false;
    }
    
    // 检查草稿是否过期（可选：比如超过30天）
    const draftAge = new Date() - new Date(draft.timestamp);
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
    
    // 检查草稿是否有用户标识（如果有的话）
    if (draft.userId && draft.userId !== userInfo.id) {
      return false;
    }
    
    return draftAge < maxAge;
  };

  // 从 localStorage 加载草稿或导航传参
  useEffect(() => {
    const draftKey = getDraftKey();
    let loadedFromDraft = false;
    if (draftKey) {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          // 验证草稿有效性
          if (!validateDraft(draft)) {
            localStorage.removeItem(draftKey);
          } else {
            setFormData({
              title: draft.title || '',
              thoughts: draft.thoughts || ''
            });
            if (draft.chatMessages && draft.chatMessages.length > 1) {
              setChatMessages(draft.chatMessages);
            }
            if (draft.pendingContent) {
              setPendingContent(draft.pendingContent);
            }
            setLastSavedTime(new Date(draft.timestamp));
            loadedFromDraft = true;
            // 记录初始内容为草稿内容
            initialDiary.current = {
              title: draft.title || '',
              thoughts: draft.thoughts || '',
              messages: draft.chatMessages || []
            };
          }
        } catch (error) {
          console.error('Error loading draft:', error);
          // 如果草稿数据损坏，删除它
          localStorage.removeItem(draftKey);
        }
      }
    }
    // 如果没有加载草稿，且有location.state，则用导航参数初始化
    if (!loadedFromDraft && location.state) {
      const { title, content, messages } = location.state;
      setFormData({
        title: title || '',
        thoughts: content || ''
      });
      setPendingContent('');
      if (messages && messages.length > 0) {
        setChatMessages([
          { role: 'system', content: 'I am an AI assistant that can help you create stories and memories.' },
          ...messages.filter(m => m.role !== 'system')
        ]);
      } else {
        setChatMessages([
          { role: 'system', content: 'I am an AI assistant that can help you create stories and memories.' }
        ]);
      }
      // 记录初始内容为导航内容
      initialDiary.current = {
        title: title || '',
        thoughts: content || '',
        messages: messages || []
      };
    }
  }, [location.state]);

  // 检查用户是否有修改
  const hasUserEdited = useCallback(() => {
    const orig = initialDiary.current;
    if (!orig) return false;
    if (formData.title !== (orig.title || '')) return true;
    if ((pendingContent || formData.thoughts) !== (orig.thoughts || '')) return true;
    const origMsgs = (orig.messages || []).filter(m => m.role !== 'system');
    const curMsgs = (chatMessages || []).filter(m => m.role !== 'system');
    if (origMsgs.length !== curMsgs.length) return true;
    for (let i = 0; i < origMsgs.length; i++) {
      if (origMsgs[i].role !== curMsgs[i].role || origMsgs[i].content !== curMsgs[i].content) return true;
    }
    
    return false;
  }, [formData.title, formData.thoughts, pendingContent, chatMessages]);

  const generatePendingContent = useCallback(async (newContent) => {
    if (!checkAuthWithRedirect()) return;
    setIsRegenerating(true);
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/api/regenerate-text`, {
        text: newContent,
        currentContent: formData.thoughts
      }, {
        headers: getAuthHeaders()
      });
      setPendingContent(response.data.regenerated_text);
    } catch (error) {
      console.error('Error regenerating text:', error);
      handleApiError(error);
      setPendingContent(newContent);
    } finally {
      setIsRegenerating(false);
    }
  }, [formData.thoughts]);

  // 初始化 VAD
  useEffect(() => {
    const initVAD = async () => {
      try {
        // 重置状态
        setIsRecording(false);
        isRecordingRef.current = false;
        setIsContinuousListening(false);
        isContinuousListeningRef.current = false;
        
        vadRef.current = new VoiceActivityDetector();
        await vadRef.current.init();
        
        // 确保状态同步
        isRecordingRef.current = isRecording;
        isContinuousListeningRef.current = isContinuousListening;
        
        // 设置回调函数
        vadRef.current.setSpeechStartCallback(() => {
          console.log('🎤 语音开始检测');
          setVadState(prev => ({ ...prev, isSpeaking: true }));
          if (isContinuousListeningRef.current) {
            console.log('🎤 触发开始录制, 当前录制状态ref:', isRecordingRef.current);
            // 只有在没有录制的情况下才开始录制
            if (!isRecordingRef.current) {
              startRecording();
            } else {
              console.log('⚠️ 已经在录制中，跳过重复开始录制');
            }
          } else {
            console.log('❌ 不在连续监听模式中，跳过录制');
          }
        });
        
        vadRef.current.setSpeechEndCallback(() => {
          console.log('🔇 语音结束检测');
          setVadState(prev => ({ ...prev, isSpeaking: false }));
          if (isContinuousListeningRef.current) {
            console.log('🔇 触发停止录制, 当前录制状态ref:', isRecordingRef.current);
            // 使用 ref 检查录制状态
            if (isRecordingRef.current) {
              stopRecording();
            } else {
              console.log('❌ 录制状态ref显示未在录制中');
            }
          } else {
            console.log(`❌ 跳过停止录制 - 连续监听ref: ${isContinuousListeningRef.current}`);
          }
        });
        
        console.log('VAD初始化成功');
      } catch (error) {
        console.error('初始化VAD失败:', error);
        setMicError('Failed to initialize voice detection: ' + error.message);
      }
    };

    // 只在语音模式下初始化VAD
    if (chatMode === 'voice') {
      initVAD();
    }

    // 清理函数
    return () => {
      if (vadRef.current) {
        vadRef.current.cleanup();
        vadRef.current = null;
      }
    };
  }, [chatMode]); // 依赖于chatMode变化

  // 监听连续语音模式状态变化
  useEffect(() => {
    // 同步 ref 与 state
    isContinuousListeningRef.current = isContinuousListening;
    
    if (vadRef.current) {
      if (isContinuousListening) {
        // 如果还没有开始监听，则开始监听
        if (!vadRef.current.getState().isListening) {
          vadRef.current.startListening();
        }
        setVadState(prev => ({ ...prev, isListening: true }));
      } else {
        vadRef.current.stopListening();
        setVadState(prev => ({ ...prev, isListening: false, isSpeaking: false }));
      }
    }
  }, [isContinuousListening]);

  // 自动保存草稿（仅有修改时）
  useEffect(() => {
    const saveDraft = () => {
      const draftKey = getDraftKey();
      if (!draftKey) return;
      const userInfo = getUserInfo();
      if (!userInfo || !userInfo.id) return;
      // 只有有修改才保存
      if (!hasUserEdited()) {
        localStorage.removeItem(draftKey);
        setLastSavedTime(null);
        lastSavedTimeRef.current = null;
        return;
      }
      const now = new Date();
      const draft = {
        userId: userInfo.id,
        title: formData.title,
        thoughts: formData.thoughts,
        pendingContent: pendingContent,
        chatMessages: chatMessages,
        timestamp: now.toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSavedTime(now);
      lastSavedTimeRef.current = now;
    };
    // 只有在有内容且有修改时才保存
    if ((formData.title.trim() || formData.thoughts.trim() || pendingContent.trim() || chatMessages.length > 1) && hasUserEdited()) {
      const timeoutId = setTimeout(saveDraft, 2000);
      return () => clearTimeout(timeoutId);
    } else {
      // 没有修改时清除草稿
      const draftKey = getDraftKey();
      if (draftKey) localStorage.removeItem(draftKey);
      setLastSavedTime(null);
      lastSavedTimeRef.current = null;
    }
  }, [formData.title, formData.thoughts, pendingContent, chatMessages, hasUserEdited]);

  // 清除草稿
  const clearDraft = () => {
    const draftKey = getDraftKey();
    if (!draftKey) return;
    
    localStorage.removeItem(draftKey);
    setLastSavedTime(null);
  };

  // 手动清除草稿并重置表单
  const clearDraftAndReset = () => {
    if (!hasUserEdited()) {
      clearDraft();
      setFormData({ title: '', thoughts: '' });
      setPendingContent('');
      setChatMessages([
        { role: 'system', content: 'I am an AI assistant that can help you create stories and memories.' }
      ]);
      setSaveStatus('Draft cleared!');
      setTimeout(() => setSaveStatus(''), 2000);
      return;
    }
    if (window.confirm('You have unsaved changes. Are you sure you want to clear the draft and start over? This action cannot be undone.')) {
      clearDraft();
      setFormData({ title: '', thoughts: '' });
      setPendingContent('');
      setChatMessages([
        { role: 'system', content: 'I am an AI assistant that can help you create stories and memories.' }
      ]);
      setSaveStatus('Draft cleared!');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  // 不再自动更新 thoughts，而是生成待保存的内容
  useEffect(() => {
    const userMessages = chatMessages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n\n');
    if (userMessages) {
      generatePendingContent(userMessages);
    }
  }, [chatMessages, generatePendingContent]);

  // (duplicate generatePendingContent removed)

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSave = async () => {
    if (!checkAuthWithRedirect()) return;
    
    const contentToSave = pendingContent || formData.thoughts;
    
    if (!contentToSave.trim()) {
      alert('Please create some content first by chatting with AI or typing in the text area.');
      return;
    }
    
    // Generate a title from the content if no title is provided
    const title = formData.title || `Story - ${new Date().toLocaleDateString()}`;

    try {
      const currentDateTime = new Date().toISOString();
      
      const response = await axios.post(`${API_BASE_URL}/api/conversations`, {
        title: title,
        content: contentToSave,
        date: currentDateTime,
        messages: chatMessages
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.id) {
        setConversationId(response.data.id);
        setSaveStatus('Story saved successfully! Redirecting in 3 seconds...');
        
        // 清除草稿
        clearDraft();
        
        setTimeout(() => {
          setFormData({
            title: '',
            thoughts: ''
          });
          setPendingContent('');
          setChatMessages([
            { role: 'system', content: 'I am an AI assistant that can help you create stories and memories.' }
          ]);
          onReturn();
        }, 3000);
      }
    } catch (error) {
      console.error('Error saving story:', error);
      handleApiError(error);
      setSaveStatus('Error saving story. Please try again.');
    }
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!chatInput.trim()) return;
    if (!checkAuthWithRedirect()) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: chatInput };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsLoading(true);
    
    try {
      // Call our backend API with voice response option
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        messages: updatedMessages,
        conversationId: conversationId,
        voice_response: chatMode === 'voice' // 如果是语音模式，请求语音回复
      }, {
        headers: getAuthHeaders()
      });
      
      // Extract the assistant's response from the API response
      const aiMessage = response.data.choices[0].message;
      
      // 如果有音频，添加音频路径到消息
      if (response.data.has_audio && response.data.audio_path) {
        aiMessage.audio_path = response.data.audio_path;
        console.log('AI message with audio:', aiMessage); // 调试日志
      } else {
        console.log('No audio in response:', response.data); // 调试日志
      }
      
      const newMessages = [...updatedMessages, aiMessage];
      setChatMessages(newMessages);
      
      // 如果是语音模式且有音频，自动播放
      if (chatMode === 'voice' && aiMessage.audio_path) {
        console.log('Auto-playing audio in voice mode'); // 调试日志
        await playAudio(aiMessage.audio_path, newMessages.length - 1);
      }
      
    } catch (error) {
      console.error('Error sending message to AI:', error);
      handleApiError(error);
      // Add error message to chat
      setChatMessages([
        ...updatedMessages, 
        { 
          role: 'system', 
          content: `Sorry, there was an error processing your request: ${error.response?.data?.error || error.message}. Please try again.` 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 开始录制
  const startRecording = async () => {
    if (!checkAuthWithRedirect()) return;
    
    // 检查是否已经在录制中
    if (isRecordingRef.current) {
      console.log('⚠️ 已经在录制中，跳过重复开始请求');
      return;
    }
    
    console.log('🎤 开始录制请求...');
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/api/asr/start`, {}, {
        headers: getAuthHeaders()
      });
      
      console.log('📡 ASR开始响应:', response.data);
      
      if (response.data.error) {
        console.error('❌ ASR开始错误:', response.data.error);
        setMicError(response.data.error);
        
        // 如果后端说已经在录制中，同步前端状态
        if (response.data.error.includes('Already recording')) {
          console.log('🔄 后端已在录制中，同步前端状态');
          setIsRecording(true);
          isRecordingRef.current = true;
          setMicError(''); // 清除错误消息，因为这不是真正的错误
        }
      } else {
        setIsRecording(true);
        isRecordingRef.current = true; // 同时更新 ref
        setTranscribedText('');
        setMicError('');
        console.log('✅ 开始录制成功, 状态ref:', isRecordingRef.current);
      }
    } catch (error) {
      console.error('❌ Start recording error:', error);
      handleApiError(error);
      setMicError('Failed to start recording: ' + (error.message || 'Unknown error'));
    }
  };

  // 停止录制
  const stopRecording = async () => {
    console.log('🔄 停止录制被调用，当前录制状态ref:', isRecordingRef.current, 'state:', isRecording);
    
    // 使用 ref 检查录制状态
    if (!isRecordingRef.current) {
      console.log('❌ 停止录制失败：当前不在录制状态');
      return;
    }
    
    console.log('🔄 正在停止录制...');
    
    // 立即设置录制状态为false，防止重复调用
    setIsRecording(false);
    isRecordingRef.current = false;
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/api/asr/stop`, {}, {
        headers: getAuthHeaders()
      });
      
      console.log('📡 ASR停止响应:', response.data);
      
      if (response.data.error) {
        console.error('❌ ASR停止错误:', response.data.error);
        setMicError(response.data.error);
        
        // 如果是连续监听模式，即使出错也要重新开始监听
        if (isContinuousListeningRef.current && vadRef.current) {
          console.log('🔄 ASR出错，重新开始监听');
          setTimeout(() => {
            if (isContinuousListeningRef.current && vadRef.current) {
              vadRef.current.startListening();
            }
          }, 1000);
        }
      } else if (response.data.text && response.data.text.trim()) {
        setTranscribedText(response.data.text);
        console.log('✅ 录制完成，转录文本:', response.data.text);
        
        // 将转录文本作为用户消息发送
        await handleVoiceMessage(response.data.text);
      } else {
        console.log('⚠️ ASR停止成功，但没有返回转录文本，可能是录制时间太短或无有效语音');
        setMicError('No speech detected. Please try speaking louder or longer.');
        
        // 如果是连续监听模式，重新开始监听
        if (isContinuousListeningRef.current && vadRef.current) {
          console.log('🔄 无有效语音，重新开始监听');
          setTimeout(() => {
            if (isContinuousListeningRef.current && vadRef.current) {
              vadRef.current.startListening();
              // 清除错误消息
              setTimeout(() => setMicError(''), 2000);
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ Stop recording error:', error);
      handleApiError(error);
      setMicError('Failed to stop recording: ' + (error.message || 'Unknown error'));
      
      // 即使出错，也要重新开始监听（如果在连续监听模式）
      if (isContinuousListeningRef.current && vadRef.current) {
        console.log('🔄 停止录制出错，重新开始监听');
        setTimeout(() => {
          if (isContinuousListeningRef.current && vadRef.current) {
            vadRef.current.startListening();
          }
        }, 1000);
      }
    }
    
    console.log('🔄 录制流程完成');
  };

  // 语音录制相关函数 - 重构后的版本
  const handleMicrophoneRequest = async () => {
    if (!checkAuthWithRedirect()) return;
    
    if (isContinuousListening) {
      // 停止连续监听模式
      setIsContinuousListening(false);
      isContinuousListeningRef.current = false; // 更新 ref
      
      // 如果正在录制，先停止录制
      if (isRecordingRef.current) {
        console.log('🔄 停止连续监听时正在录制，先停止录制');
        await stopRecording();
      }
      
      setIsRecording(false);
      isRecordingRef.current = false; // 重置 ref
      console.log('停止连续语音模式');
    } else {
      // 开始连续监听模式
      if (!vadRef.current) {
        setMicError('Voice detection not initialized. Please try again.');
        return;
      }
      
      setIsContinuousListening(true);
      isContinuousListeningRef.current = true; // 更新 ref
      setMicError('');
      console.log('开始连续语音模式');
    }
  };

  const handleVoiceMessage = async (transcribedText) => {
    if (!transcribedText || !transcribedText.trim()) {
      console.log('❌ 转录文本为空或无效，跳过处理');
      
      // 如果是连续监听模式，重新开始监听
      if (isContinuousListeningRef.current && vadRef.current) {
        console.log('🔄 转录文本无效，重新开始监听');
        setTimeout(() => {
          if (isContinuousListeningRef.current && vadRef.current) {
            vadRef.current.startListening();
          }
        }, 500);
      }
      return;
    }
    
    console.log('🗣️ 处理语音消息:', transcribedText);
    
    // Add user message to chat
    const userMessage = { role: 'user', content: transcribedText };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setIsLoading(true);
    
    try {
      console.log('📡 发送消息给AI...');
      // Call our backend API with voice response
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        messages: updatedMessages,
        conversationId: conversationId,
        voice_response: true // 语音模式始终请求语音回复
      }, {
        headers: getAuthHeaders()
      });
      
      console.log('✅ AI响应:', response.data);
      
      // Extract the assistant's response from the API response
      const aiMessage = response.data.choices[0].message;
      
      // 如果有音频，添加音频路径到消息
      if (response.data.has_audio && response.data.audio_path) {
        aiMessage.audio_path = response.data.audio_path;
        console.log('🔊 Voice message AI response with audio:', aiMessage); // 调试日志
      } else {
        console.log('⚠️ No audio in voice response:', response.data); // 调试日志
      }
      
      const newMessages = [...updatedMessages, aiMessage];
      setChatMessages(newMessages);
      
      // 自动播放AI回复的语音
      if (aiMessage.audio_path) {
        console.log('🔊 Auto-playing voice response audio'); // 调试日志
        await playAudio(aiMessage.audio_path, newMessages.length - 1);
      } else {
        // 如果没有音频，直接重新开始监听
        if (isContinuousListening && vadRef.current) {
          console.log('🔄 AI回复完成（无音频），重新开始监听');
          setTimeout(() => {
            if (isContinuousListening && vadRef.current) {
              vadRef.current.startListening();
            }
          }, 500);
        }
      }
      
    } catch (error) {
      console.error('❌ Error sending voice message to AI:', error);
      handleApiError(error);
      // Add error message to chat
      setChatMessages([
        ...updatedMessages, 
        { 
          role: 'system', 
          content: `Sorry, there was an error processing your voice message: ${error.response?.data?.error || error.message}. Please try again.` 
        }
      ]);
      
      // 即使出错也要重新开始监听
      if (isContinuousListening && vadRef.current) {
        console.log('🔄 处理语音消息出错，重新开始监听');
        setTimeout(() => {
          if (isContinuousListening && vadRef.current) {
            vadRef.current.startListening();
          }
        }, 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 音频播放相关函数
  const playAudio = async (audioPath, messageIndex) => {
    try {
      console.log('Playing audio:', audioPath); // 调试日志
      
      // 停止当前播放的音频
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      setCurrentPlayingMessage(messageIndex);
      setIsPlaying(true);
      
      // 创建带认证的音频URL
      const token = getAccessToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const audioUrl = `${API_BASE_URL}/api/audio/${encodeURIComponent(audioPath)}?token=${token}`;
      console.log('Audio URL:', audioUrl); // 调试日志
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      // 添加事件监听器
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentPlayingMessage(null);
        audioRef.current = null;
        
        // 在连续语音模式下，音频播放完成后重新开始监听
        if (isContinuousListening && vadRef.current) {
          console.log('音频播放完成，重新开始监听');
          setTimeout(() => {
            if (isContinuousListening && vadRef.current) {
              vadRef.current.startListening();
            }
          }, 500);
        }
      };
      
      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsPlaying(false);
        setCurrentPlayingMessage(null);
        audioRef.current = null;
        
        // 即使出错也要重新开始监听
        if (isContinuousListening && vadRef.current) {
          console.log('音频播放出错，重新开始监听');
          setTimeout(() => {
            if (isContinuousListening && vadRef.current) {
              vadRef.current.startListening();
            }
          }, 500);
        }
      };
      
      // 播放音频
      await audio.play();
      
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      setCurrentPlayingMessage(null);
      
      // 即使出错也要重新开始监听
      if (isContinuousListening && vadRef.current) {
        console.log('音频播放异常，重新开始监听');
        setTimeout(() => {
          if (isContinuousListening && vadRef.current) {
            vadRef.current.startListening();
          }
        }, 500);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentPlayingMessage(null);
  };

  return (
    <div className="desktop-frame">
      <div className="story-container">
          {/* 离开按钮示例：可根据实际UI放置 */}
          {/* <button onClick={handleReturn}>Back</button> */}
          <div className="form-and-chat">
            <div className="story-form">
              <div className="form-group">
                <div className="input-container">
                  <input 
                    type="text" 
                    name="title" 
                    value={formData.title} 
                    onChange={handleChange}
                    placeholder="Set a Title"
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <div className="input-container">
                  <textarea 
                    name="thoughts" 
                    value={pendingContent || formData.thoughts} 
                    onChange={(e) => {
                      // 当用户手动编辑时，清除待保存内容，使用用户输入
                      if (pendingContent) {
                        setPendingContent('');
                      }
                      handleChange(e);
                    }}
                    placeholder="Type your Thoughts"
                    className="form-textarea"
                    rows={10}
                  />
                  {isRegenerating && (
                    <div className="regenerating-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="buttons-container">
                <button 
                  type="button" 
                  className="action-button"
                  onClick={handleSave}
                  disabled={!pendingContent && !formData.thoughts}
                >
                  Save
                </button>
                {lastSavedTime && (
                  <button 
                    type="button" 
                    className="action-button secondary"
                    onClick={clearDraftAndReset}
                    title="Clear draft and start over"
                  >
                    Clear Draft
                  </button>
                )}
              </div>
              
              {/* 草稿状态显示 */}
              {lastSavedTime && (
                <div className="draft-status">
                  <span className="draft-indicator">
                    📝 Draft auto-saved at {(lastSavedTimeRef.current || lastSavedTime).toLocaleTimeString()}
                    <br />
                    <small style={{ opacity: 0.7 }}>Your draft will be preserved when you log out</small>
                  </span>
                </div>
              )}
              
              {saveStatus && (
                <div className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}>
                  {saveStatus}
                </div>
              )}
            </div>
            
            <div className="chat-container">
              <div className="chat-header">
                <h2 className="chat-title">Chat with AI</h2>
                <div className="chat-mode-toggle">
                  <button 
                    className={`mode-button ${chatMode === 'text' ? 'active' : ''}`}
                    onClick={() => setChatMode('text')}
                  >
                    💬 Text
                  </button>
                  <button 
                    className={`mode-button ${chatMode === 'voice' ? 'active' : ''}`}
                    onClick={() => setChatMode('voice')}
                  >
                    🎤 Voice
                  </button>
                </div>
              </div>
              
              <div className="chat-messages">
                {chatMessages.map((message, index) => (
                  <div key={index} className={`chat-message ${message.role}`}>
                    <div className="message-content">
                      {message.content}
                      {message.role === 'assistant' && message.audio_path && (
                        <div className="message-actions">
                          <button 
                            className={`audio-button ${currentPlayingMessage === index ? 'playing' : ''}`}
                            onClick={() => {
                              if (currentPlayingMessage === index && isPlaying) {
                                stopAudio();
                              } else {
                                playAudio(message.audio_path, index);
                              }
                            }}
                          >
                            {currentPlayingMessage === index && isPlaying ? '⏹️' : '🔊'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="chat-message assistant">
                    <div className="message-content loading">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {chatMode === 'text' ? (
                <form className="chat-input-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={handleChatInputChange}
                    placeholder="Ask the AI for help with your story..."
                    className="chat-input"
                  />
                  <button type="submit" className="send-button" disabled={isLoading}>
                    Send
                  </button>
                </form>
              ) : ( 
                <div className="voice-buttons">
                  {micError && (
                    <div className="error-message">
                      {micError}
                    </div>
                  )}
                  <button 
                    className={`voice-button ${isContinuousListening ? 'listening' : ''}`} 
                    onClick={handleMicrophoneRequest}
                    disabled={isLoading}
                  >
                    {isContinuousListening ? (
                      <>
                        <span className="recording-indicator"></span>
                        Stop Voice Chat
                      </>
                    ) : (
                      <>
                        🎤 Start Voice Chat
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
};

export default WriteStory;