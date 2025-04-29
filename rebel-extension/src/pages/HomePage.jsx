import "./css/HomePage.css";
import AccordionMenu from "../components/AccordionMenu";
import SidePanelButton from "../components/SidePanelButton";

import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

/**
 * Main UI Layout for the Chrome Extension.
 */
function HomePage() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [user, setUser] = useState(null);
  const DropdownRef = useRef(null);
  
  const handleClickAway = (event) => {
    if (DropdownRef.current && !DropdownRef.current.contains(event.target)) {
      setShowDropdown(false);
    }
  };
  
  //Used to handle clicking away from the dropdown
  useEffect(() => {
    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, []);

  // Resize popup to original size when HomePage loads
  useEffect(() => {
    // Wait a tick to make sure layout is rendered
    setTimeout(() => {
      window.resizeTo(330, 400);
    }, 50);
    chrome.storage.sync.get(["user"], (data) => {
      if (data.user) {
        setUser(data.user);
      }
    });
  }, []);

  return (
    <div>
      <div className="banner">
        <img
          src="/images/rebel-remind.png"
          alt="Rebel Remind Logo"
          className="rebel-remind-logo"
          style={{ width: "65%" }}
        />

        {/*Change View Dropdown Floating */}
        <div className="profile-container">
          {/* Ensures user.picture exists */}
          {user ?
            (
              <img
                src={user.picture}
                alt="Profile Picture"
                width="40px"
                className="profile-pic"
                onClick={() => setShowDropdown((prev) => !prev)}
              />
            )
            :
            (
              <div className="settings-button-container">
                <button
                  className="settings-button"
                  onClick={() => navigate("/settings")}
                >
                  ⚙️
                </button>
              </div>
            )
          }
          {showDropdown && (
            <div className="change-view-dropdown" ref={DropdownRef}>
              <button onClick={() => navigate("/user-events")}>
                Create an Event
              </button>
              <SidePanelButton />
              <button onClick={() => navigate("/pomodoro")}>
                Pomodoro
              </button>
              <button onClick={() => navigate("/settings")}>
                Settings
              </button>
            </div>
          )}
        </div>
      </div>
      <AccordionMenu />

    </div>
  );
}

export default HomePage;

