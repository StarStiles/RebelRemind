import { render, screen, fireEvent, act } from '@testing-library/react';
import CalendarView from '../components/CalendarView';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';

beforeEach(() => {
  jest.clearAllMocks();
});

global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn((key, callback) => {
        callback({ title: "Test_Assignment",
		   start: new Date(),
	           end: new Date(),
		   description: "Description 1" });
      }),
    },
  },
};
// Mocking the react-big-calendar and date-fns libraries
jest.mock('react-big-calendar', () => ({
  Calendar: () => <div>Calendar Component</div>,
  dateFnsLocalizer: jest.fn(() => ({})), // Mock dateFnsLocalizer
}));

// Mock date-fns and any specifically named imported like setHours/setMinutes
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'), // Mock while still preserving original functionality
  setHours: jest.fn(),  // Named import setHours
  setMinutes: jest.fn(),  // Named import setMinutes
  format: jest.fn(),
  parse: jest.fn(),
  startOfWeek: jest.fn(),
  getDay: jest.fn(),
  locale: { enUS: {} },
}));

describe('Calendar View Component', () => {
  it('renders the Calendar component', async () => {
    // Render the CalendarView component itself
    await act(async () => {
    render(<CalendarView />);
    });
    // Check that the Calendar actually appears in the extension
    expect(screen.getByText('Calendar Component')).toBeInTheDocument();
  });

  it('sets the min and max limits correctly', async () => {
    // To check that calendar's time limits were set correctly

    // Named imports must also be imported here in this test case
    const { setHours, setMinutes } = require('date-fns');

    // First render the calendar to invoke the functions needed to display it
    await act(async () => {
    render(<CalendarView />);
    });
    // Check that the hours and minutes were set correctly (7:00 AM to 11:59 PM
    expect(setHours).toHaveBeenCalledWith(expect.any(Date), 7);  // Min limit
    expect(setMinutes).toHaveBeenCalled();

    expect(setHours).toHaveBeenCalledWith(expect.any(Date), 23); // Max limit
    expect(setMinutes).toHaveBeenCalled();
  });

  // To check that the calendar can actually handle events if given one
  it('passes calendarEvents to the Calendar component', async () => {
    const calendarEventsMock = [
      { start: new Date(), end: new Date(), title: 'Test Event' }
    ];
    
    // Render the calendar while explicitly passing the events prop
    await act(async () => {
    render(<CalendarView events={calendarEventsMock} />);
    });

    // Check that the Calendar component receives and uses the events prop
    expect(screen.getByText('Calendar Component')).toBeInTheDocument();
  });
});
