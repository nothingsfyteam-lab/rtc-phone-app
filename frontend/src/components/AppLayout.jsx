import { useState } from 'react';
import { useCall } from '../context/CallContext';
import { Phone, Users, Check, X, UserPlus, PhoneCall, Copy, Settings } from 'lucide-react';
import ContextMenu from './ContextMenu';

export default function AppLayout() {
    const {
        myNumber, friends, friendRequests,
        callState, incomingCall,
        startCall, acceptCall, rejectCall,
        acceptFriendRequest, declineFriendRequest, sendFriendRequest
    } = useCall();

    const [dialNumber, setDialNumber] = useState('');
    const [activeTab, setActiveTab] = useState('dialer'); // dialer, contacts

    const [contextMenuState, setContextMenuState] = useState({
        visible: false,
        x: 0,
        y: 0,
        targetNumber: null
    });

    const handleDial = (e) => {
        e.preventDefault();
        if (dialNumber.length === 12) {
            startCall(dialNumber);
        }
    };

    const handleRightClick = (e, number) => {
        e.preventDefault();
        setContextMenuState({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            targetNumber: number
        });
    };

    const closeContextMenu = () => {
        setContextMenuState(prev => ({ ...prev, visible: false }));
    }

    return (
        <div className="layout-container" onClick={closeContextMenu}>
            {/* Sidebar - PC Context */}
            <div className="sidebar">
                <div style={styles.header}>
                    <div style={styles.identityBadge}>
                        <span style={styles.myNumberLabel}>MY ID</span>
                        <span style={styles.myNumber}>{myNumber?.match(/.{1,4}/g)?.join('-')}</span>
                    </div>
                    <div style={styles.tabs}>
                        <button
                            className={`tab-btn ${activeTab === 'dialer' ? 'active' : ''}`}
                            onClick={() => setActiveTab('dialer')}
                            style={activeTab === 'dialer' ? styles.activeTab : styles.tab}
                        >
                            <Phone size={18} /> Dialer
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('contacts')}
                            style={activeTab === 'contacts' ? styles.activeTab : styles.tab}
                        >
                            <Users size={18} /> Contacts
                        </button>
                    </div>
                </div>

                <div style={styles.contentArea}>
                    {activeTab === 'dialer' && (
                        <div style={styles.dialerContainer}>
                            <form onSubmit={handleDial} style={styles.dialForm}>
                                <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem' }}>Initiate Connection</h2>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Enter 12-digit ID..."
                                    value={dialNumber}
                                    onChange={(e) => setDialNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                                    style={styles.dialInput}
                                />
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={dialNumber.length !== 12 || callState !== 'idle'}
                                    style={styles.dialButton}
                                >
                                    <PhoneCall size={20} fill="currentColor" /> Establish Link
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'contacts' && (
                        <div style={styles.contactsContainer}>
                            {/* Friend Requests Section */}
                            {friendRequests.length > 0 && (
                                <div style={styles.requestsSection}>
                                    <h3 style={styles.sectionTitle}>Link Requests ({friendRequests.length})</h3>
                                    {friendRequests.map(req => (
                                        <div key={req} style={styles.requestItem}>
                                            <span style={{ fontSize: '0.9rem' }}>{req}</span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => acceptFriendRequest(req)} className="btn btn-icon" style={{ width: '32px', height: '32px', padding: 0, background: '#22c55e', color: 'white' }}>
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => declineFriendRequest(req)} className="btn btn-icon" style={{ width: '32px', height: '32px', padding: 0, background: '#ef4444', color: 'white' }}>
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Contacts List */}
                            <div style={styles.friendsList}>
                                <h3 style={styles.sectionTitle}>Network Nodes</h3>
                                {friends.length === 0 ? (
                                    <p style={{ color: '#666', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>No connections in the grid.</p>
                                ) : (
                                    friends.map(friend => (
                                        <div
                                            key={friend.number}
                                            style={styles.contactItem}
                                            onContextMenu={(e) => handleRightClick(e, friend.number)}
                                        // onClick={() => startCall(friend.number)}
                                        >
                                            <div style={styles.contactAvatar}>{friend.name.charAt(0)}</div>
                                            <div style={styles.contactInfo}>
                                                <span style={styles.contactName}>{friend.name}</span>
                                                <span style={styles.contactNumber}>{friend.number}</span>
                                            </div>
                                            <button
                                                className="btn btn-icon"
                                                style={styles.callContactBtn}
                                                onClick={(e) => { e.stopPropagation(); startCall(friend.number); }}
                                            >
                                                <Phone size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main View Area (Empty/Active Call will render here in App.jsx via Context) */}
            <div className={`main-area ${callState === 'idle' ? 'main-area-idle' : ''}`}>
                {callState === 'idle' ? (
                    <div style={styles.idleState}>
                        <div className="pulse-circle"></div>
                        <p style={{ color: '#444', letterSpacing: '2px', textTransform: 'uppercase' }}>System Ready</p>
                    </div>
                ) : null}

                {/* Incoming Call Overlay */}
                {callState === 'ringing' && incomingCall && (
                    <div style={styles.incomingCallOverlay} className="animate-fade-in">
                        <div style={styles.ringingBox}>
                            <div className="pulse-ring" style={styles.pulseRing}></div>
                            <div style={{ zIndex: 10, position: 'relative', textAlign: 'center' }}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Incoming Transmission</h2>
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', letterSpacing: '4px', marginBottom: '2rem' }}>
                                    {incomingCall.fromNumber}
                                </p>
                                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                                    <button className="btn" style={{ ...styles.actionBtn, background: '#ff3b30', borderColor: '#ff3b30' }} onClick={rejectCall}>
                                        <Phone size={24} style={{ transform: 'rotate(135deg)' }} />
                                        <span style={{ marginLeft: '8px' }}>Decline</span>
                                    </button>
                                    <button className="btn" style={{ ...styles.actionBtn, background: '#34c759', borderColor: '#34c759', color: 'black' }} onClick={acceptCall}>
                                        <Phone size={24} className="animate-pulse" />
                                        <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>Accept</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ContextMenu
                visible={contextMenuState.visible}
                x={contextMenuState.x}
                y={contextMenuState.y}
                onClose={closeContextMenu}
                actions={[
                    {
                        label: 'Add to Network',
                        icon: <UserPlus size={16} />,
                        onClick: () => {
                            sendFriendRequest(contextMenuState.targetNumber);
                            alert('Request Dispatched to ' + contextMenuState.targetNumber);
                        }
                    },
                    {
                        label: 'Copy ID',
                        icon: <Copy size={16} />,
                        onClick: () => navigator.clipboard.writeText(contextMenuState.targetNumber)
                    }
                ]}
            />
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        height: '100%',
        width: '100%',
        backgroundColor: '#000',
        color: '#fff',
        overflow: 'hidden'
    },
    sidebar: {
        width: '380px',
        height: '100%',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#050505',
        flexShrink: 0
    },
    mainArea: {
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #111 0%, #000 100%)'
    },
    idleState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5
    },
    header: {
        padding: '2rem 1.5rem 1rem',
        borderBottom: '1px solid #222'
    },
    identityBadge: {
        marginBottom: '2rem',
        background: '#111',
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    myNumberLabel: {
        fontSize: '0.7rem',
        fontWeight: 'bold',
        color: '#888',
        letterSpacing: '2px'
    },
    myNumber: {
        fontSize: '1.4rem',
        fontWeight: '600',
        letterSpacing: '2px',
        color: '#fff'
    },
    tabs: {
        display: 'flex',
        gap: '8px',
        background: '#111',
        padding: '4px',
        borderRadius: '999px',
        border: '1px solid #222'
    },
    tab: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        color: '#888',
        padding: '8px 16px',
        borderRadius: '999px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'all 0.2s'
    },
    activeTab: {
        flex: 1,
        background: '#fff',
        border: 'none',
        color: '#000',
        padding: '8px 16px',
        borderRadius: '999px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '0.9rem',
        fontWeight: '600',
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
    },
    contentArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
    },
    dialerContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
    },
    dialForm: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        background: '#0a0a0a',
        padding: '2rem',
        borderRadius: '16px',
        border: '1px solid #222'
    },
    dialInput: {
        fontSize: '1.8rem',
        textAlign: 'center',
        letterSpacing: '4px',
        padding: '1rem',
        fontWeight: '600'
    },
    dialButton: {
        width: '100%',
        padding: '16px',
        fontSize: '1.1rem',
        borderRadius: '12px'
    },
    contactsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
    },
    sectionTitle: {
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        color: '#666',
        marginBottom: '1rem'
    },
    requestsSection: {
        background: '#1a1a1a',
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid #333'
    },
    requestItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #222',
    },
    friendsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    contactItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        background: '#0a0a0a',
        borderRadius: '12px',
        border: '1px solid #222',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    contactAvatar: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: '#333',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '1.2rem',
        marginRight: '12px'
    },
    contactInfo: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
    },
    contactName: {
        fontWeight: '500',
        fontSize: '1rem',
        color: '#fff'
    },
    contactNumber: {
        fontSize: '0.8rem',
        color: '#666',
        letterSpacing: '1px'
    },
    callContactBtn: {
        width: '36px',
        height: '36px',
        background: '#fff',
        color: '#000',
        padding: 0
    },
    incomingCallOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100
    },
    ringingBox: {
        background: '#111',
        border: '1px solid #333',
        padding: '3rem 4rem',
        borderRadius: '24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
    },
    pulseRing: {
        position: 'absolute',
        top: '50%', left: '50%',
        width: '100%', height: '100%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        transform: 'translate(-50%, -50%)',
        animation: 'pulse 2s infinite'
    },
    actionBtn: {
        padding: '14px 28px',
        borderRadius: '999px',
        display: 'flex',
        alignItems: 'center',
        border: 'none',
        color: '#fff'
    }
};
