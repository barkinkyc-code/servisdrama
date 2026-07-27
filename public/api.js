// API Client for ServisDrama

const API = {
  baseURL: window.location.protocol === 'file:' ? 'http://localhost:3000/api' : `${window.location.origin}/api`,
  token: localStorage.getItem('token'),

  // Set token
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  },

  // Get headers
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  },

  // Login
  async login(username, password) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (data.success) {
        this.setToken(data.token);
        return data;
      }
      throw new Error(data.error);
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  },

  // Get all data
  async getData() {
    try {
      const response = await fetch(`${this.baseURL}/data`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (err) {
      console.error('Get data error:', err);
      throw err;
    }
  },

  // Save data
  async saveData(data) {
    try {
      const response = await fetch(`${this.baseURL}/data`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (err) {
      console.error('Save data error:', err);
      throw err;
    }
  },

  // Update data
  async updateData(id, data) {
    try {
      const response = await fetch(`${this.baseURL}/data/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (err) {
      console.error('Update data error:', err);
      throw err;
    }
  },

  // Delete data
  async deleteData(id) {
    try {
      const response = await fetch(`${this.baseURL}/data/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (err) {
      console.error('Delete data error:', err);
      throw err;
    }
  },

  // Export JSON
  async exportJSON() {
    window.location.href = `${this.baseURL}/backup/export/json`;
  },

  // Export CSV
  async exportCSV() {
    window.location.href = `${this.baseURL}/backup/export/csv`;
  },

  // Export SQL
  async exportSQL() {
    window.location.href = `${this.baseURL}/backup/export/sql`;
  },

  // Get backup stats
  async getBackupStats() {
    try {
      const response = await fetch(`${this.baseURL}/backup/stats`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (err) {
      console.error('Get backup stats error:', err);
      throw err;
    }
  },

  // Create backup
  async createBackup() {
    try {
      const response = await fetch(`${this.baseURL}/backup/create`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (err) {
      console.error('Create backup error:', err);
      throw err;
    }
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
