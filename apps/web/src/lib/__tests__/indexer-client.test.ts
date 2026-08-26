import { IndexerClient, IndexerClientError } from '../indexer-client';

describe('IndexerClient', () => {
  const client = new IndexerClient('https://api.test.com');

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should serialize query parameters correctly on GET requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    await client.request({
      endpoint: 'search',
      params: { q: 'stellar', limit: 10 },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test.com/search?q=stellar&limit=10',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should attach Authorization header when token is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await client.request({
      endpoint: 'protected',
      token: 'secret-token-123',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test.com/protected',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token-123',
        }),
      })
    );
  });

  it('should throw IndexerClientError on non-ok responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Bad Request' }),
    });

    await expect(client.request({ endpoint: 'bad' })).rejects.toThrow(
      new IndexerClientError(400, 'Bad Request')
    );
  });
});