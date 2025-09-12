class VoiceActivityDetector {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.dataArray = null;
    this.isListening = false;
    this.isRecording = false;
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSpeechDetected = null;
    this.onAudioLevel = null; // 添加音频级别回调
    
    // VAD 参数 - 根据实际音频级别调整阈值
    this.silenceThreshold = 0.002; // 静音阈值 (低于正常说话)
    this.speechThreshold = 0.004; // 语音开始阈值 (低于你的实际说话音频级别)
    this.silenceDuration = 1500; // 静音持续时间（毫秒）(增加到1.5秒，确保用户真的说完了)
    this.speechStartDelay = 200; // 语音开始延迟（毫秒）(增加延迟，减少误触发)
    
    // 状态跟踪
    this.silenceTimer = null;
    this.speechTimer = null;
    this.isSpeaking = false;
    this.lastSpeechTime = 0;
    this.speechStartTime = 0; // 添加语音开始时间
    this.minRecordingTime = 1000; // 最小录制时间1秒
    this.lastLogTime = 0; // 用于控制日志输出频率
    this.lastAudioUpdateTime = 0; // 用于控制音频级别更新频率
    
    // 音频级别历史
    this.audioLevels = [];
    this.maxHistoryLength = 20;
    
    console.log('语音活动检测器已创建');
  }

  async init() {
    try {
      // 请求麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      console.log('语音活动检测器初始化成功 - 麦克风权限已获取');
      return true;
    } catch (error) {
      console.error('初始化VAD失败:', error);
      throw error;
    }
  }

  startListening() {
    if (!this.mediaStream) {
      console.error('VAD未初始化 - 没有媒体流');
      return false;
    }

    try {
      // 在用户交互时创建音频上下文
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // 恢复音频上下文
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // 创建音频分析器
      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        source.connect(this.analyser);
        
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }

      this.isListening = true;
      this.isSpeaking = false;
      this.lastSpeechTime = 0;
      this.speechStartTime = 0; // 重置语音开始时间
      
      this.detectVoiceActivity();
      console.log('开始语音活动检测');
      return true;
    } catch (error) {
      console.error('启动语音检测失败:', error);
      return false;
    }
  }

  stopListening() {
    this.isListening = false;
    this.isSpeaking = false;
    this.speechStartTime = 0; // 重置语音开始时间
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
    
    console.log('停止语音活动检测');
  }

  detectVoiceActivity() {
    if (!this.isListening || !this.analyser) return;

    // 获取时域音频数据（更适合语音检测）
    this.analyser.getByteTimeDomainData(this.dataArray);
    
    // 计算音频级别
    const audioLevel = this.calculateAudioLevel();
    
    // 更新音频级别历史
    this.audioLevels.push(audioLevel);
    if (this.audioLevels.length > this.maxHistoryLength) {
      this.audioLevels.shift();
    }
    
    // 计算平均级别
    const avgLevel = this.audioLevels.reduce((sum, level) => sum + level, 0) / this.audioLevels.length;
    
    const now = Date.now();
    
    // 实时发送音频级别（每50ms更新一次）
    if (this.onAudioLevel && now - this.lastAudioUpdateTime > 50) {
      this.onAudioLevel(audioLevel);
      this.lastAudioUpdateTime = now;
    }
    
    // 详细的音频级别日志（每秒输出一次）
    if (now - this.lastLogTime > 1000) {
      console.log(`🎵 音频级别: ${audioLevel.toFixed(4)}, 平均: ${avgLevel.toFixed(4)}, 语音阈值: ${this.speechThreshold}, 静音阈值: ${this.silenceThreshold}`);
      this.lastLogTime = now;
    }
    
    // 检测语音开始
    if (!this.isSpeaking && audioLevel > this.speechThreshold) {
      if (!this.speechTimer) {
        console.log(`🎤 语音开始检测条件满足 - 音频级别: ${audioLevel.toFixed(4)}, 语音阈值: ${this.speechThreshold}`);
        this.speechTimer = setTimeout(() => {
          if (this.isListening && !this.isSpeaking) {
            this.isSpeaking = true;
            this.lastSpeechTime = now;
            this.speechStartTime = now; // 记录语音开始时间
            console.log('✅ 检测到语音开始');
            if (this.onSpeechStart) {
              this.onSpeechStart();
            }
          }
          this.speechTimer = null;
        }, this.speechStartDelay);
      }
    }
    
    // 调试语音检测条件
    if (now - this.lastLogTime > 1000) {
      console.log(`🔍 语音检测状态: isSpeaking=${this.isSpeaking}, audioLevel=${audioLevel.toFixed(4)}, speechThreshold=${this.speechThreshold}, speechTimer=${!!this.speechTimer}`);
    }
    
    // 检测语音结束
    if (this.isSpeaking) {
      if (audioLevel > this.silenceThreshold) {
        this.lastSpeechTime = now;
        
        // 清除静音计时器
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else {
        // 开始静音计时器
        if (!this.silenceTimer) {
          console.log(`🔇 开始静音检测 - 音频级别: ${audioLevel.toFixed(4)}, 静音阈值: ${this.silenceThreshold}`);
          this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.isSpeaking) {
              const recordingDuration = now - this.speechStartTime;
              console.log(`🔇 检测到语音结束，录制时长: ${recordingDuration}ms，最小时长: ${this.minRecordingTime}ms`);
              
              if (recordingDuration >= this.minRecordingTime) {
                this.isSpeaking = false;
                console.log('✅ 录制时长足够，触发语音结束');
                if (this.onSpeechEnd) {
                  this.onSpeechEnd();
                }
              } else {
                console.log('⚠️ 录制时长不足，继续监听');
                // 录制时长不足，继续监听
                this.lastSpeechTime = now;
              }
            }
            this.silenceTimer = null;
          }, this.silenceDuration);
        }
      }
    }
    
    // 持续检测
    if (this.isListening) {
      requestAnimationFrame(() => this.detectVoiceActivity());
    }
  }

  calculateAudioLevel() {
    if (!this.dataArray) return 0;
    
    // 对于时域数据，计算RMS（均方根）值
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      // 将字节值转换为-1到1的范围
      const sample = (this.dataArray[i] - 128) / 128;
      sum += sample * sample;
    }
    
    // 返回RMS值
    return Math.sqrt(sum / this.dataArray.length);
  }

  // 设置回调函数
  setSpeechStartCallback(callback) {
    this.onSpeechStart = callback;
  }

  setSpeechEndCallback(callback) {
    this.onSpeechEnd = callback;
  }

  setSpeechDetectedCallback(callback) {
    this.onSpeechDetected = callback;
  }

  setAudioLevelCallback(callback) {
    this.onAudioLevel = callback;
  }

  // 清理资源
  cleanup() {
    console.log('停止语音活动检测');
    this.stopListening();
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
    
    console.log('语音活动检测器已清理');
  }

  // 获取当前状态
  getState() {
    return {
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      isRecording: this.isRecording
    };
  }
}

export default VoiceActivityDetector;
