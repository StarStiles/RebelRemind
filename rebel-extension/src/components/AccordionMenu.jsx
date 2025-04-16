import { useEffect, useState, useRef } from "react";

import Accordion from 'react-bootstrap/Accordion';
import CanvasAssignments from "./CanvasAssignments";
import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * Accordion Menu Component - Creates a drop-down style menu that displays the three (3) main submenus of the extension.
 * Uses React Bootstrap to display and format the menu.
 *
 * Features:
 * - Upon opening the extension, it displays a collapsed collection of submenus
 * 	- Upcoming Assignments
 * 	- Your Events
 *	- UNLV Events
 *
 * Authored by: Jeremy Besitula
 * 
 * Put into component AccordionMenu.jsx by Jeremy Besitula
 * @returns {JSX.Element} The AccordionMenu component UI.
 */
function AccordionMenu() {
  return (
    <div className="accordion-scroll-wrapper">
      <Accordion defaultActiveKey={["0", "1", "2"]} alwaysOpen>
      	<Accordion.Item eventKey="0">
      	<Accordion.Header>📚 Upcoming Assignments</Accordion.Header>
          <Accordion.Body className="accordion-panel-scroll">
          {/* • <strong> 🗺️ History 405:</strong> Homework 3 due by this Sunday <strong> <br />
          • <strong> 💻 CS 472:</strong> DP II</strong> due by next week Tuesday. */}
          <CanvasAssignments>
          </CanvasAssignments>
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey="1">
          <Accordion.Header>📅 Your Events</Accordion.Header>
          <Accordion.Body className="accordion-panel-scroll">
          • 🗓️ General Meeting - <strong> 11:30 AM </strong> with <strong>Hindu Yuva Club</strong>. <br />
          • 🕛 Office Hours - <strong>2:00 PM </strong> with the GOAT 🐐 Kishore. <br />
          • 🏀 UNLV <strong>Basketball Game - </strong> 5:00 PM <strong>!</strong>.  <br />
          • 🕛 Office Hours - <strong>5:00 PM </strong> with the DR. Pedersen.
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey="2">
          <Accordion.Header>🎉 UNLV Events</Accordion.Header>
          <Accordion.Body className="accordion-panel-scroll">
          • 🏀 UNLV <strong>Basketball Game - </strong> 5:00 PM <strong>!</strong>. <br />
          • 🐶 Pet therapy - 3:00 PM located in the <strong>Lied Library</strong>! <br />
          🗓️ General Meeting - <strong> 11:30 AM </strong> with <strong>Hindu Yuva Club</strong>. <br />
          • 🕛 Volleyball Tryouts - <strong>8:00 PM </strong> with Coach Tarina.
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
    
  );
}

export default AccordionMenu;
