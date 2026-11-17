import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { geocode } from './data/geocode';
import { fetchBars } from './data/overpass';
import { DataError, type Bar } from './data/types';

vi.mock('./data/geocode', () => ({ geocode: vi.fn() }));
vi.mock('./data/overpass', () => ({ fetchBars: vi.fn() }));

const geocodeMock = vi.mocked(geocode);
const fetchBarsMock = vi.mocked(fetchBars);

const AUSTIN = { lat: 30.2711, lon: -97.7437, displayName: 'Austin, Texas, United States' };

const bar = (id: string, name: string, openingHoursRaw?: string, distanceMeters = 800): Bar => ({
  id,
  name,
  lat: AUSTIN.lat,
  lon: AUSTIN.lon,
  distanceMeters,
  ...(openingHoursRaw ? { openingHoursRaw } : {}),
});

const BARS: Bar[] = [
  bar('node/1', 'The Night Owl', 'Mo-Su 17:00-02:00'),
  bar('node/2', 'Early Bird Tavern', 'Mo-Su 12:00-22:00', 1200),
  bar('node/3', 'Insomnia Lounge', '24/7', 300),
  bar('node/4', 'Shuttered Pub', 'off'),
  bar('node/5', 'Mystery Bar'),
];

async function searchFor(place: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Or type a town or address'), place);
  await user.click(screen.getByRole('button', { name: 'Search' }));
  return user;
}

function stubGeolocation(getCurrentPosition: Geolocation['getCurrentPosition']) {
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
}

beforeEach(() => {
  geocodeMock.mockResolvedValue(AUSTIN);
  fetchBarsMock.mockResolvedValue(BARS);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('App', () => {
  it('shows the Day Walker title, an accessible vampire logo and the OpenStreetMap credit', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Day Walker' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Day Walker vampire logo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
  });

  it('offers 1, 2, 5, 10 and 25 km with 5 km preselected', () => {
    render(<App />);
    const radius = screen.getByLabelText('Search within');
    expect(within(radius).getAllByRole('option').map((o) => o.textContent)).toEqual([
      '1 km',
      '2 km',
      '5 km',
      '10 km',
      '25 km',
    ]);
    expect(radius).toHaveValue('5');
  });

  it('geocodes a typed place and shows the four groups in order with counts and close times', async () => {
    render(<App />);
    await searchFor('Austin');

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Day Walkers1 bar',
      'Night Crawlers2 bars',
      'Closed tonight1 bar',
      'Hours unknown1 bar',
    ]);
    expect(geocodeMock).toHaveBeenCalledWith('Austin', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fetchBarsMock).toHaveBeenCalledWith(
      { lat: AUSTIN.lat, lon: AUSTIN.lon },
      5000,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const night = screen.getByRole('region', { name: /Night Crawlers/ });
    const owl = within(night).getByRole('heading', { level: 3, name: 'The Night Owl' }).closest('li')!;
    expect(owl).toHaveTextContent(/Closes 2:00\sAM/);
    expect(owl).toHaveTextContent('0.8 km away');
    expect(within(owl).getByText('Hours')).toBeInTheDocument();
    expect(within(owl).getByText('Mo-Su 17:00-02:00')).toBeInTheDocument();
    // Earliest close first: the 2:00 AM bar comes before the all-night one.
    expect(within(night).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'The Night Owl',
      'Insomnia Lounge',
    ]);
    expect(within(night).getByText('Open all night')).toBeInTheDocument();

    const day = screen.getByRole('region', { name: /Day Walkers/ });
    expect(within(day).getByText(/10:00\sPM/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('5 bars within 5 km of Austin, Texas, United States');
  });

  it('searches around the device position when location is granted', async () => {
    stubGeolocation((success) =>
      success({ coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition),
    );
    render(<App />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Use my location' }));

    await screen.findByRole('heading', { level: 2, name: /Day Walkers/ });
    expect(geocodeMock).not.toHaveBeenCalled();
    expect(fetchBarsMock).toHaveBeenCalledWith({ lat: 51.5, lon: -0.12 }, 5000, expect.anything());
  });

  it('explains when location is denied and moves focus to the place field', async () => {
    stubGeolocation((_success, error) =>
      error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    );
    render(<App />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Use my location' }));

    expect(screen.getByText('Location is off. Type a town or address instead.')).toBeInTheDocument();
    const field = screen.getByLabelText('Or type a town or address');
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription('Location is off. Type a town or address instead.');
    expect(fetchBarsMock).not.toHaveBeenCalled();
  });

  it('treats a browser without geolocation the same as location being off', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    render(<App />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByText('Location is off. Type a town or address instead.')).toBeInTheDocument();
    expect(screen.getByLabelText('Or type a town or address')).toHaveFocus();
  });

  it('announces loading politely and disables Search until the search settles', async () => {
    let finish: (bars: Bar[]) => void = () => {};
    fetchBarsMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<App />);
    await searchFor('Austin');

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(status).toHaveTextContent('Looking for bars within 5 km…'));
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();

    finish(BARS);
    await screen.findByRole('heading', { level: 2, name: /Day Walkers/ });
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
  });

  it('says no bars were found and widens to the next radius on request', async () => {
    fetchBarsMock.mockResolvedValueOnce([]);
    render(<App />);
    const user = await searchFor('Austin');

    expect(await screen.findByText('No bars found within 5 km.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search within 10 km' }));

    await screen.findByRole('heading', { level: 2, name: /Day Walkers/ });
    expect(fetchBarsMock).toHaveBeenLastCalledWith(expect.anything(), 10_000, expect.anything());
    expect(geocodeMock).toHaveBeenLastCalledWith('Austin', expect.anything());
    expect(screen.getByLabelText('Search within')).toHaveValue('10');
  });

  it('offers another place instead of a wider radius at 25 km', async () => {
    fetchBarsMock.mockResolvedValueOnce([]);
    render(<App />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Search within'), '25');
    await searchFor('Nowhere');

    expect(await screen.findByText('No bars found within 25 km.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Type another place' }));
    expect(screen.getByLabelText('Or type a town or address')).toHaveFocus();
  });

  it('shows a plain-language error and reruns the same search on Try again', async () => {
    fetchBarsMock.mockRejectedValueOnce(new DataError('network', 'HTTP 503 from https://overpass-api.de'));
    render(<App />);
    const user = await searchFor('Austin');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't reach the bar map right now. Try again in a moment.");
    expect(alert).not.toHaveTextContent(/HTTP|503/);

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 2, name: /Day Walkers/ });
    expect(geocodeMock).toHaveBeenCalledTimes(2);
    expect(geocodeMock).toHaveBeenLastCalledWith('Austin', expect.anything());
    expect(fetchBarsMock).toHaveBeenLastCalledWith(expect.anything(), 5000, expect.anything());
  });

  it("says when a typed place can't be found", async () => {
    geocodeMock.mockRejectedValueOnce(new DataError('notFound'));
    render(<App />);
    await searchFor('Atlantis');
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't find that place.");
    expect(fetchBarsMock).not.toHaveBeenCalled();
  });
});
