/**
 * ChittyLedger Evidence Management Interface
 * Complete UI for evidence upload, AI processing, and chain of custody tracking
 */

import React, { useState, useEffect } from 'react';
import { Upload, FileText, Shield, Brain, Clock, CheckCircle, AlertCircle, Database } from 'lucide-react';

const EvidenceManager = () => {
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [evidenceId, setEvidenceId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  // Status color mapping for soft/hard minting
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    soft_minted: 'bg-blue-100 text-blue-800',
    hard_minted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    verified: 'bg-purple-100 text-purple-800',
    archived: 'bg-gray-100 text-gray-800'
  };

  // Upload evidence file
  const handleEvidenceUpload = async () => {
    if (!uploadFile || !evidenceId) {
      alert('Please select a file and enter an Evidence ID');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('evidenceId', evidenceId);
      formData.append('caseId', caseId);

      const response = await fetch('/evidence/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Host': 'evidence.chitty.cc'
        }
      });

      const result = await response.json();

      if (response.ok) {
        // Add to evidence list
        setEvidenceItems(prev => [...prev, {
          evidenceId,
          fileName: uploadFile.name,
          fileHash: result.fileHash,
          artifactId: result.artifactId,
          chainStatus: 'pending',
          aiMetadata: result.aiMetadata,
          uploadedAt: new Date().toISOString()
        }]);

        // Reset form
        setUploadFile(null);
        setEvidenceId('');
        alert('Evidence uploaded and processed successfully!');
      } else {
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Upload error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update evidence status
  const updateEvidenceStatus = async (evidenceId, newStatus) => {
    try {
      const response = await fetch('/evidence/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'evidence.chitty.cc'
        },
        body: JSON.stringify({
          evidenceId,
          status: newStatus,
          metadata: {
            updatedBy: 'User',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (response.ok) {
        // Update local state
        setEvidenceItems(prev =>
          prev.map(item =>
            item.evidenceId === evidenceId
              ? { ...item, chainStatus: newStatus }
              : item
          )
        );
        alert(`Status updated to ${newStatus}`);
      }
    } catch (error) {
      alert(`Status update failed: ${error.message}`);
    }
  };

  // Soft mint (off-chain verification)
  const softMintEvidence = async (evidenceId) => {
    try {
      const response = await fetch('/evidence/soft-mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'evidence.chitty.cc'
        },
        body: JSON.stringify({
          evidenceId,
          metadata: {
            reason: 'Initial verification',
            verifiedBy: 'ChittyOS System',
            caseId: caseId || 'TBD'
          }
        })
      });

      const result = await response.json();

      if (response.ok) {
        // Update local state
        setEvidenceItems(prev =>
          prev.map(item =>
            item.evidenceId === evidenceId
              ? { ...item, chainStatus: 'soft_minted', mintType: 'soft', gasCost: 0 }
              : item
          )
        );
        alert('✅ Evidence soft minted successfully (off-chain, no gas cost)');
      } else {
        alert(`Soft minting failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Soft minting error: ${error.message}`);
    }
  };

  // Hard mint (on-chain blockchain recording)
  const hardMintEvidence = async (evidenceId) => {
    // Check eligibility first
    try {
      const checkResponse = await fetch(`/evidence/mint-status?evidenceId=${evidenceId}`, {
        headers: {
          'Host': 'evidence.chitty.cc'
        }
      });

      const eligibility = await checkResponse.json();

      if (!eligibility.canHardMint) {
        alert('⚠️ Evidence must be soft minted first before hard minting to blockchain');
        return;
      }

      // Estimate gas cost
      const gasCost = eligibility.size ? (21000 + Math.ceil(eligibility.size / 32) * 68) * 0.00002 : 0.01;

      const confirmHardMint = confirm(
        `⛽ Hard Minting to Blockchain\n\n` +
        `This will permanently record the evidence on-chain.\n` +
        `Estimated Gas Cost: ${gasCost.toFixed(4)} ETH\n` +
        `This action is IRREVERSIBLE.\n\n` +
        `Do you want to proceed?`
      );

      if (!confirmHardMint) return;

      const response = await fetch('/evidence/hard-mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'evidence.chitty.cc'
        },
        body: JSON.stringify({
          evidenceId,
          blockchainData: {
            network: 'ChittyChain',
            courtJurisdiction: 'Cook County, Illinois',
            caseNumber: caseId || 'TBD',
            criticalEvidence: true
          }
        })
      });

      const result = await response.json();

      if (response.ok) {
        // Update local state
        setEvidenceItems(prev =>
          prev.map(item =>
            item.evidenceId === evidenceId
              ? {
                  ...item,
                  chainStatus: 'hard_minted',
                  mintType: 'hard',
                  blockHash: result.blockHash,
                  transactionHash: result.transactionHash,
                  blockNumber: result.blockNumber,
                  gasCost: result.gasCost
                }
              : item
          )
        );
        alert(
          `🔗 Evidence permanently recorded on blockchain!\n\n` +
          `Transaction: ${result.transactionHash}\n` +
          `Block: ${result.blockNumber}\n` +
          `Gas Used: ${result.gasCost.estimatedCost} ETH`
        );
      } else {
        alert(`Hard minting failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Hard minting error: ${error.message}`);
    }
  };

  // Load evidence details
  const loadEvidenceDetails = async (evidenceId) => {
    try {
      const response = await fetch(`/evidence/${evidenceId}`, {
        headers: {
          'Host': 'evidence.chitty.cc'
        }
      });

      if (response.ok) {
        const details = await response.json();
        setSelectedEvidence(JSON.parse(details));
      }
    } catch (error) {
      console.error('Failed to load evidence details:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="w-8 h-8" />
          ChittyLedger Evidence Management
        </h1>
        <p className="text-blue-100 mt-2">
          Blockchain-verified legal evidence with AI processing and immutable chain of custody
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Evidence
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence ID
            </label>
            <input
              type="text"
              value={evidenceId}
              onChange={(e) => setEvidenceId(e.target.value)}
              placeholder="e.g., EV-2024-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Case ID (Optional)
            </label>
            <input
              type="text"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="e.g., CASE-2024-D-007847"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Evidence File
          </label>
          <input
            type="file"
            onChange={(e) => setUploadFile(e.target.files[0])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
          />
        </div>

        <button
          onClick={handleEvidenceUpload}
          disabled={loading || !uploadFile || !evidenceId}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload & Process
            </>
          )}
        </button>
      </div>

      {/* Evidence List */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Evidence Registry
        </h2>

        {evidenceItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No evidence uploaded yet. Upload your first evidence file above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4">Evidence ID</th>
                  <th className="text-left py-3 px-4">File Name</th>
                  <th className="text-left py-3 px-4">Artifact ID</th>
                  <th className="text-left py-3 px-4">Chain Status</th>
                  <th className="text-left py-3 px-4">AI Analysis</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidenceItems.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{item.evidenceId}</td>
                    <td className="py-3 px-4">{item.fileName}</td>
                    <td className="py-3 px-4 font-mono text-sm">{item.artifactId}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.chainStatus]}`}>
                        {item.chainStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.aiMetadata && (
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-600" />
                          <span className="text-sm">
                            {item.aiMetadata.evidenceType} ({item.aiMetadata.confidenceScore}%)
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => loadEvidenceDetails(item.evidenceId)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Details
                        </button>
                        {item.chainStatus === 'pending' && (
                          <button
                            onClick={() => softMintEvidence(item.evidenceId)}
                            className="text-blue-600 hover:text-blue-800 text-sm bg-blue-50 px-2 py-1 rounded"
                          >
                            ☁️ Soft Mint
                          </button>
                        )}
                        {item.chainStatus === 'soft_minted' && (
                          <>
                            <span className="text-blue-600 text-sm">✓ Soft</span>
                            <button
                              onClick={() => hardMintEvidence(item.evidenceId)}
                              className="text-green-600 hover:text-green-800 text-sm bg-green-50 px-2 py-1 rounded"
                            >
                              ⛓️ Hard Mint
                            </button>
                          </>
                        )}
                        {item.chainStatus === 'hard_minted' && (
                          <span className="text-green-600 text-sm font-medium">
                            🔗 On-Chain
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evidence Details Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Evidence Details</h3>
                <button
                  onClick={() => setSelectedEvidence(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Evidence ID</label>
                    <p className="font-mono">{selectedEvidence.evidenceId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">File Hash</label>
                    <p className="font-mono text-xs break-all">{selectedEvidence.fileHash}</p>
                  </div>
                </div>

                {selectedEvidence.aiMetadata && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      AI Analysis
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Evidence Type:</strong> {selectedEvidence.aiMetadata.evidenceType}</p>
                      <p><strong>Confidence Score:</strong> {selectedEvidence.aiMetadata.confidenceScore}%</p>
                      <p><strong>Legal Facts:</strong> {selectedEvidence.aiMetadata.legalFacts}</p>
                      <p><strong>Relevance:</strong> {selectedEvidence.aiMetadata.relevanceAssessment}</p>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Chain Status
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedEvidence.chainStatus]}`}>
                      {selectedEvidence.chainStatus}
                    </span>
                    <span className="text-sm text-gray-600">
                      Last updated: {new Date(selectedEvidence.lastUpdated || selectedEvidence.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Technical Details</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><strong>Artifact ID:</strong> {selectedEvidence.artifactId}</p>
                    <p><strong>File Size:</strong> {selectedEvidence.size ? (selectedEvidence.size / 1024).toFixed(2) + ' KB' : 'Unknown'}</p>
                    <p><strong>Content Type:</strong> {selectedEvidence.contentType || 'Unknown'}</p>
                    <p><strong>Uploaded:</strong> {new Date(selectedEvidence.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Integration Status */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-800">ChittyLedger Integration Active</h3>
            <p className="text-sm text-green-700">
              Evidence automatically syncs with Notion database • AI processing enabled • Blockchain verification active
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{evidenceItems.length}</p>
              <p className="text-sm text-gray-600">Total Evidence</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 text-blue-600 text-2xl">☁️</div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {evidenceItems.filter(item => item.chainStatus === 'soft_minted').length}
              </p>
              <p className="text-sm text-gray-600">Soft Minted</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 text-green-600 text-2xl">⛓️</div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {evidenceItems.filter(item => item.chainStatus === 'hard_minted').length}
              </p>
              <p className="text-sm text-gray-600">Hard Minted</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {evidenceItems.filter(item => item.chainStatus === 'pending').length}
              </p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {evidenceItems.filter(item => item.aiMetadata).length}
              </p>
              <p className="text-sm text-gray-600">AI Processed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceManager;