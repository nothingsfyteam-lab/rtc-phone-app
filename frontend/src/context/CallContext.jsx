import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const SIGNALING_URL = window.location.origin;

export const CallProvider = ({ children }) => {
    const socketRef = useRef(null);
    const localStreamRef = useRef(null);

    // Audio Streaming Refs
    const audioCtxRef = useRef(null);
    const micSourceRef = useRef(null);
    const processorRef = useRef(null);
    const playbackStartTimeRef = useRef(0);

    const [myNumber, setMyNumber] = useState(null);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);

    const [callState, setCallState] = useState('idle');
    const [activeCallContact, setActiveCallContact] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null); // Dummy for UI compat

    const [localVideoEnabled, setLocalVideoEnabled] = useState(false);
    const [localAudioEnabled, setLocalAudioEnabled] = useState(true);

    // ─── Audio Context Setup ───────────────────────────────────────────────────
    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            playbackStartTimeRef.current = audioCtxRef.current.currentTime;
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    };

    // ─── Capture & Send Audio ──────────────────────────────────────────────────
    const startStreaming = async (targetNumber) => {
        console.log('[Stream] Starting capture to', targetNumber);
        initAudio();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            const source = audioCtxRef.current.createMediaStreamSource(stream);
            // ScriptProcessor is deprecated but widely supported for simple streaming
            const processor = audioCtxRef.current.createScriptProcessor(4096, 1, 1);

            source.connect(processor);
            processor.connect(audioCtxRef.current.destination); // Required to trigger onaudioprocess

            processor.onaudioprocess = (e) => {
                if (callState !== 'active') return;

                const inputData = e.inputBuffer.getChannelData(0);
                // Convert to Int16 to save bandwidth
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    int16Data[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                }

                socketRef.current?.emit('audio_chunk', {
                    targetNumber,
                    chunk: int16Data.buffer
                });
            };

            micSourceRef.current = source;
            processorRef.current = processor;
        } catch (err) {
            console.error('[Stream] Capture failed', err);
            alert('Could not access microphone for streaming.');
        }
    };

    const stopStreaming = () => {
        console.log('[Stream] Stopping');
        processorRef.current?.disconnect();
        micSourceRef.current?.disconnect();
        localStreamRef.current?.getTracks().forEach(t => t.stop());

        processorRef.current = null;
        micSourceRef.current = null;
        localStreamRef.current = null;
    };

    // ─── Receive & Play Audio ──────────────────────────────────────────────────
    const handleRemoteAudio = (chunk) => {
        if (!audioCtxRef.current || callState !== 'active') return;

        const int16Data = new Int16Array(chunk);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 0x7FFF;
        }

        const buffer = audioCtxRef.current.createBuffer(1, float32Data.length, 16000);
        buffer.getChannelData(0).set(float32Data);

        const source = audioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);

        // Simple scheduling to handle jitter
        const now = audioCtxRef.current.currentTime;
        if (playbackStartTimeRef.current < now) {
            playbackStartTimeRef.current = now + 0.1; // Latency buffer
        }

        source.start(playbackStartTimeRef.current);
        playbackStartTimeRef.current += buffer.duration;
    };

    // ─── Call Actions ────────────────────────────────────────────────────────────
    const startCall = async (targetNumber) => {
        console.log('[Call] Initiating link to', targetNumber);
        initAudio();
        setActiveCallContact(targetNumber);
        setCallState('calling');
        socketRef.current?.emit('call_offer', { targetNumber });
    };

    const acceptCall = async () => {
        if (!incomingCall) return;
        console.log('[Call] Accepting link from', incomingCall.fromNumber);
        initAudio();
        const target = incomingCall.fromNumber;
        setActiveCallContact(target);
        setCallState('active');
        setIncomingCall(null);
        socketRef.current?.emit('call_answer', { targetNumber: target });
        startStreaming(target);
    };

    const rejectCall = () => {
        if (!incomingCall) return;
        socketRef.current?.emit('call_ended', { targetNumber: incomingCall.fromNumber });
        setIncomingCall(null);
        setCallState('idle');
    };

    const endCall = useCallback(() => {
        console.log('[Call] Ending link');
        if (activeCallContact) {
            socketRef.current?.emit('call_ended', { targetNumber: activeCallContact });
        }
        stopStreaming();
        setCallState('idle');
        setActiveCallContact(null);
        setIncomingCall(null);
    }, [activeCallContact]);

    const toggleAudio = () => {
        setLocalAudioEnabled(!localAudioEnabled);
        // In this implementation, we just stop sending if disabled?
        // Or actually mute the processor.
    };

    const toggleVideo = () => {
        alert('Video is currently disabled in built-in streaming mode.');
    };

    const inviteToCall = (n) => startCall(n);

    // ─── Socket ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem('friends');
        if (saved) try { setFriends(JSON.parse(saved)); } catch { }

        const socket = io(SIGNALING_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.emit('register', localStorage.getItem('myNumber') || undefined);

        socket.on('registered', ({ number }) => {
            setMyNumber(number);
            localStorage.setItem('myNumber', number);
        });

        socket.on('call_offer', ({ fromNumber }) => {
            console.log('[Socket] Incoming link from', fromNumber);
            setIncomingCall({ fromNumber });
            setCallState('ringing');
        });

        socket.on('call_answer', ({ fromNumber }) => {
            console.log('[Socket] Link accepted by', fromNumber);
            setCallState('active');
            startStreaming(fromNumber);
        });

        socket.on('audio_chunk', ({ chunk }) => {
            handleRemoteAudio(chunk);
        });

        socket.on('call_ended', () => {
            console.log('[Socket] Link terminated by remote');
            stopStreaming();
            setCallState('idle');
            setActiveCallContact(null);
            setIncomingCall(null);
        });

        // Friend logic (unchanged)
        socket.on('friend_request_received', ({ fromNumber }) => {
            setFriendRequests(prev => [...prev.filter(n => n !== fromNumber), fromNumber]);
        });
        socket.on('friend_request_accepted', ({ byNumber }) => {
            setFriends(prev => {
                if (prev.find(f => f.number === byNumber)) return prev;
                const next = [...prev, { number: byNumber, name: `Contact ${byNumber.slice(-4)}` }];
                localStorage.setItem('friends', JSON.stringify(next));
                return next;
            });
        });

        return () => socket.disconnect();
    }, []);

    // ─── Social ──────────────────────────────────────────────────────────────────
    const addFriend = (number, name) => {
        setFriends(prev => {
            if (prev.find(f => f.number === number)) return prev;
            const next = [...prev, { number, name }];
            localStorage.setItem('friends', JSON.stringify(next));
            return next;
        });
    };
    const sendFriendRequest = (n) => socketRef.current?.emit('friend_request', { targetNumber: n });
    const acceptFriendRequest = (n) => {
        socketRef.current?.emit('friend_request_accepted', { targetNumber: n });
        setFriendRequests(prev => prev.filter(x => x !== n));
        addFriend(n, `Contact ${n.slice(-4)}`);
    };
    const declineFriendRequest = (n) => {
        socketRef.current?.emit('friend_request_denied', { targetNumber: n });
        setFriendRequests(prev => prev.filter(x => x !== n));
    };
    const updateFriendName = (number, newName) => {
        setFriends(prev => {
            const next = prev.map(f => f.number === number ? { ...f, name: newName } : f);
            localStorage.setItem('friends', JSON.stringify(next));
            return next;
        });
    };

    const remoteStreams = {}; // Compat
    const remoteStreamRef = useRef(null);

    return (
        <CallContext.Provider value={{
            myNumber, friends, friendRequests,
            callState, activeCallContact, incomingCall,
            localVideoEnabled, localAudioEnabled,
            remoteStream, remoteStreams, localStreamRef,
            sendFriendRequest, acceptFriendRequest, declineFriendRequest, updateFriendName,
            startCall, acceptCall, rejectCall, endCall, toggleVideo, toggleAudio, inviteToCall,
        }}>
            {children}
        </CallContext.Provider>
    );
};
