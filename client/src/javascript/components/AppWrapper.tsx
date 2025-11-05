import classnames from 'classnames';
import {CSSTransition} from 'react-transition-group';
import {FC, ReactNode, useEffect} from 'react';
import {observer} from 'mobx-react-lite';
import {useEffectOnce} from 'react-use';
import {useNavigate} from 'react-router';
import {useSearchParams} from 'react-router-dom';
import {css} from '@client/styled-system/css';

import AuthActions from '@client/actions/AuthActions';
import AuthStore from '@client/stores/AuthStore';
import ConfigStore from '@client/stores/ConfigStore';
import ClientStatusStore from '@client/stores/ClientStatusStore';
import UIStore from '@client/stores/UIStore';

import ClientConnectionInterruption from './general/ClientConnectionInterruption';
import WindowTitle from './general/WindowTitle';
import LoadingOverlay from './general/LoadingOverlay';
import LogoutButton from './sidebar/LogoutButton';

interface AppWrapperProps {
  children: ReactNode;
  className?: string;
}

// Helper function to check if a string is a valid torrent URL
const isTorrentURL = (text: string): boolean => {
  const trimmedText = text.trim();
  return trimmedText.startsWith('magnet:') || trimmedText.startsWith('http://') || trimmedText.startsWith('https://');
};

const AppWrapper: FC<AppWrapperProps> = observer(({children, className}: AppWrapperProps) => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  useEffectOnce(() => {
    AuthActions.verify().then(
      ({initialUser}: {initialUser?: boolean}): void => {
        if (initialUser) {
          navigate('/register', {replace: true});
        } else {
          navigate('/overview', {replace: true});
        }
      },
      (): void => {
        navigate('/login', {replace: true});
      },
    );
  });

  // Handle URL paste events
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Don't interfere if user is pasting into an input/textarea element
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Get pasted text
      const pastedText = event.clipboardData?.getData('text');
      if (!pastedText) {
        return;
      }

      // Check if it's a torrent URL
      if (isTorrentURL(pastedText)) {
        event.preventDefault();
        UIStore.setActiveModal({
          id: 'add-torrents',
          tab: 'by-url',
          urls: [{id: 0, value: pastedText.trim()}],
        });
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Handle URL drag-and-drop events
  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      // Check if dragging contains text/url
      const hasText =
        event.dataTransfer?.types.includes('text/plain') || event.dataTransfer?.types.includes('text/uri-list');

      if (hasText) {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      }
    };

    const handleDrop = (event: DragEvent) => {
      // Get dropped text/URL
      const droppedText = event.dataTransfer?.getData('text/plain') || event.dataTransfer?.getData('text/uri-list');

      if (!droppedText) {
        return;
      }

      // Check if it's a torrent URL
      if (isTorrentURL(droppedText)) {
        event.preventDefault();
        UIStore.setActiveModal({
          id: 'add-torrents',
          tab: 'by-url',
          urls: [{id: 0, value: droppedText.trim()}],
        });
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  if (searchParams.has('action')) {
    if (searchParams.get('action') === 'add-urls') {
      if (searchParams.has('url')) {
        UIStore.setActiveModal({
          id: 'add-torrents',
          tab: 'by-url',
          urls: [{id: 0, value: searchParams.get('url') as string}],
        });
      }
    }
  }

  const showDepsOverlay =
    !AuthStore.isAuthenticating || (AuthStore.isAuthenticated && !UIStore.haveUIDependenciesResolved);
  const showConnOverlay =
    AuthStore.isAuthenticated && !ClientStatusStore.isConnected && ConfigStore.authMethod !== 'none';

  return (
    <div className={classnames('application', className)}>
      <WindowTitle />
      <CSSTransition
        mountOnEnter={true}
        unmountOnExit={true}
        in={showDepsOverlay}
        timeout={{enter: 1000, exit: 1000}}
        classNames="application__loading-overlay"
      >
        <LoadingOverlay dependencies={UIStore.dependencies} />
      </CSSTransition>
      <CSSTransition
        mountOnEnter={true}
        unmountOnExit={true}
        in={showConnOverlay}
        timeout={{enter: 1000, exit: 1000}}
        classNames="application__loading-overlay"
      >
        <div className="application__loading-overlay">
          <div className="application__entry-barrier">
            <LogoutButton className={css({position: 'absolute', left: '5px', top: '5px'})} />
            <ClientConnectionInterruption />
          </div>
        </div>
      </CSSTransition>
      {children}
    </div>
  );
});

export default AppWrapper;
