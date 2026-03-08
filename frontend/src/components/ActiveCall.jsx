import { useState, useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Users, Plus } from 'lucide-react';


export default function ActiveCall() {
    const {
        callState, activeCallContact, endCall,
        localVideoEnabled, localAudioEnabled, toggleVideo, toggleAudio,
        localStreamRef, remoteStream, inviteToCall
    } = useCall();

    const [inviteNumber, setInviteNumber] = useState('');
    const [showInvitePopup, setShowInvitePopup] = useState(false);

    const localVideoEl = useRef(null);
    const remoteVideoEl = useRef(null);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoEl.current && localStreamRef.current) {
            localVideoEl.current.srcObject = localStreamRef.current;
        }
    }, [localVideoEnabled]);

    // Attach remote stream to video element (for video calls)
    useEffect(() => {
        if (remoteVideoEl.current && remoteStream) {
            remoteVideoEl.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    if (callState !== 'active' && callState !== 'calling') return null;

    const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0;

    return (
        <div style={styles.container} className="animate-fade-in">
            <div style={styles.header}>
                <div style={styles.statusBadge}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: callState === 'calling' ? '#f59e0b' : '#10b981' }}></div>
                    <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}>
                        {callState === 'calling' ? 'Connecting...' : 'Call Active'}
                    </span>
                </div>
            </div>

            <div style={styles.videoGrid}>
                {hasRemoteVideo ? (
                    <video ref={remoteVideoEl} autoPlay playsInline style={styles.peerVideo} />
                ) : (
                    <div style={styles.peerContainer}>
                        <div style={styles.voiceOnlyBox}>
                            <div style={styles.voiceAvatar}>
                                {activeCallContact ? activeCallContact.slice(-4) : '...'}
                            </div>
                            <div style={styles.voiceName}>{activeCallContact}</div>
                            {remoteStream && (
                                <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '0.75rem', letterSpacing: '1px' }}>
                                    ● LIVE
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Local video pip */}
            {localVideoEnabled && (
                <div style={styles.localVideoContainer}>
                    <video ref={localVideoEl} autoPlay playsInline muted style={styles.localVideo} />
                </div>
            )}

            {/* Controls Bar */}
            <div style={styles.controlsBar}>
                <button
                    className="btn btn-icon"
                    onClick={toggleAudio}
                    style={{ ...styles.controlBtn, background: localAudioEnabled ? '#222' : '#fff', color: localAudioEnabled ? '#fff' : '#000' }}
                >
                    {localAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <button
                    className="btn btn-icon"
                    onClick={toggleVideo}
                    style={{ ...styles.controlBtn, background: localVideoEnabled ? '#222' : '#fff', color: localVideoEnabled ? '#fff' : '#000' }}
                >
                    {localVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>

                <button
                    className="btn btn-icon"
                    onClick={() => setShowInvitePopup(!showInvitePopup)}
                    style={styles.controlBtn}
                    title="Add to Call"
                >
                    <Users size={20} />
                </button>

                <button
                    className="btn btn-icon btn-danger"
                    onClick={() => endCall(null)} // Null ends all
                    style={{ ...styles.controlBtn, width: '64px', borderRadius: '32px' }}
                >
                    <PhoneOff size={24} />
                </button>
            </div>

            {/* Invite Popup */}
            {showInvitePopup && (
                <div style={styles.invitePopup} className="animate-fade-in">
                    <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Invite Node</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="12-digit ID"
                            value={inviteNumber}
                            onChange={e => setInviteNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                            style={{ padding: '8px 12px', fontSize: '1rem' }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                if (inviteNumber.length === 12) {
                                    inviteToCall(inviteNumber);
                                    setInviteNumber('');
                                    setShowInvitePopup(false);
                                }
                            }}
                            disabled={inviteNumber.length !== 12}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Subcomponent for each remote peer
function RemotePeer({ number, stream }) {
    const videoRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        // Always create an Audio element imperatively and keep it alive for the
        // duration of this peer's lifetime. This avoids the React conditional
        // rendering timing bug where a JSX <audio> mounts AFTER the effect.
        if (!audioRef.current) {
            const audio = new Audio();
            audio.autoplay = true;
            // Needed for iOS Safari
            audio.setAttribute('playsinline', '');
            audioRef.current = audio;
        }

        if (stream) {
            console.log('[Audio] Attaching stream to audio element for', number);
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(e => console.warn('[Audio] play() failed:', e));
        }

        // Attach video too if available
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.srcObject = null;
                audioRef.current = null;
            }
        };
    }, [stream]);

    const hasVideoTrack = stream && stream.getVideoTracks().length > 0;

    return (
        <div style={styles.peerContainer}>
            {hasVideoTrack ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={styles.peerVideo}
                />
            ) : (
                <div style={styles.voiceOnlyBox}>
                    <div style={styles.voiceAvatar}>{number ? number.slice(-4) : '...'}</div>
                    <div style={styles.voiceName}>{number}</div>
                    {stream && <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.5rem' }}>● Live</div>}
                </div>
            )}
        </div>
    );
}


const styles = {
    container: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#050505',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10
    },
    header: {
        position: 'absolute',
        top: '2rem',
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 20
    },
    statusBadge: {
        background: 'rgba(20,20,20,0.8)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #333',
        padding: '8px 20px',
        borderRadius: '999px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    videoGrid: {
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        padding: '6rem 2rem 8rem 2rem', // leave room for header and controls
        gap: '1rem',
        justifyContent: 'center',
        alignItems: 'center'
    },
    peerContainer: {
        flex: '1 1 auto',
        minWidth: '300px',
        maxWidth: '800px',
        height: '100%',
        maxHeight: '600px',
        background: '#111',
        borderRadius: '24px',
        border: '1px solid #222',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    peerVideo: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    voiceOnlyBox: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem'
    },
    voiceAvatar: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: '#222',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#fff',
        border: '2px solid #333',
        position: 'relative',
        zIndex: 2
    },
    voiceName: {
        fontSize: '1.2rem',
        letterSpacing: '2px',
        color: '#aaa',
        zIndex: 2
    },
    speakingIndicator: {
        position: 'absolute',
        width: '120px',
        height: '120px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'pulse 2s infinite',
        zIndex: 1
    },
    localVideoContainer: {
        position: 'absolute',
        bottom: '120px',
        right: '2rem',
        width: '200px',
        height: '300px',
        background: '#000',
        borderRadius: '16px',
        border: '2px solid #333',
        overflow: 'hidden',
        zIndex: 30,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    },
    localVideo: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)' // mirror for local
    },
    controlsBar: {
        position: 'absolute',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '1rem',
        background: 'rgba(15,15,15,0.9)',
        backdropFilter: 'blur(20px)',
        padding: '12px 24px',
        borderRadius: '999px',
        border: '1px solid #333',
        zIndex: 40
    },
    controlBtn: {
        width: '52px',
        height: '52px',
        background: '#222',
        border: 'none'
    },
    invitePopup: {
        position: 'absolute',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1a1a1a',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '1px solid #333',
        zIndex: 50,
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
    }
};
