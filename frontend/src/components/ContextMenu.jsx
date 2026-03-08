import { useEffect, useRef } from 'react';

export default function ContextMenu({ visible, x, y, actions, onClose }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (visible) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [visible, onClose]);

    if (!visible) return null;

    // Keep menu within viewport
    const style = {
        top: Math.min(y, window.innerHeight - (actions.length * 40 + 20)),
        left: Math.min(x, window.innerWidth - 200)
    };

    return (
        <div ref={menuRef} className="context-menu animate-fade-in" style={style}>
            {actions.map((action, idx) => (
                <div
                    key={idx}
                    className="context-menu-item"
                    onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                        onClose();
                    }}
                >
                    {action.icon}
                    <span>{action.label}</span>
                </div>
            ))}
        </div>
    );
}
