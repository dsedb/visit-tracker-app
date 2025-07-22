// 設定
  var CONFIG = {
      // あなたのGASウェブアプリURLに置き換えてください
      GAS_URL: 'https://script.google.com/macros/s/AKfycby76mHiKsihN27PbkQqRFjSiUGf_-ksF9O2fRgKUwdvWonJgkHtruDvVNhoAnQCmJIjiA/exec',
      // あなたのスプレッドシートのCSV公開URLに置き換えてください
    
      //SPREADSHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/1MFUK_MzwFAxnIErM7pF_69Z9vCdgRAfLFp0axX5sQfo/export?format=csv&gid=0',
      SPREADSHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/2PACX-1vRdKEEOTcDwCDLOStHif1hK89RlDWuLyor09fWo3ZtwZIGnLq_fnYCizHKlDyF2m4AV2_YrZCLI5RXV/export?format=csv&gid=0',    
      AUTH_TOKEN: 'visit_tracker_2024_secure_token'
  };

  // グローバル変数
  var map;
  var markers = [];
  var visitData = [];
  var visitRecords = [];

  // マップ初期化
  function initMap() {
      // 日本の中心部に地図を設定
      map = L.map('map').setView([35.6762, 139.6503], 6);

      // OpenStreetMapタイルレイヤーを追加
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // データを読み込み
      loadVisitData();

      // チームフィルターイベント
      document.getElementById('teamFilter').addEventListener('change', filterByTeam);

      // 訪問記録フォームイベント
      document.getElementById('visitRecordForm').addEventListener('submit', submitVisitRecord);
  }

  // 訪問地データを読み込み
  function loadVisitData() {
      document.getElementById('loading').style.display = 'block';

      fetch(CONFIG.SPREADSHEET_CSV_URL)
          .then(function(response) {
              return response.text();
          })
          .then(function(csvText) {
              parseCSVData(csvText);
              document.getElementById('loading').style.display = 'none';
          })
          .catch(function(error) {
              console.error('データ読み込みエラー:', error);
              alert('データの読み込みに失敗しました。CSVのURLを確認してください。');
              document.getElementById('loading').style.display = 'none';
          });
  }

  // CSVデータを解析
  function parseCSVData(csvText) {
      var lines = csvText.split('\n');
      visitData = [];

      // ヘッダー行をスキップ
      for (var i = 1; i < lines.length; i++) {
          var row = parseCSVRow(lines[i]);
          if (row.length >= 5 && row[0]) {
              visitData.push({
                  id: row[0],
                  name: row[1],
                  address: row[2],
                  lat: parseFloat(row[3]),
                  lng: parseFloat(row[4])
              });
          }
      }

      createMarkers();
      loadVisitRecords();
  }

  // CSV行を解析（簡易版）
  function parseCSVRow(row) {
      var result = [];
      var current = '';
      var inQuotes = false;

      for (var i = 0; i < row.length; i++) {
          var char = row[i];
          if (char === '"') {
              inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
          } else {
              current += char;
          }
      }
      result.push(current.trim());
      return result;
  }

  // マーカーを作成
  function createMarkers() {
      // 既存のマーカーをクリア
      markers.forEach(function(marker) {
          map.removeLayer(marker);
      });
      markers = [];

      visitData.forEach(function(point) {
          if (!isNaN(point.lat) && !isNaN(point.lng)) {
              var marker = L.marker([point.lat, point.lng])
                  .bindPopup(createPopupContent(point))
                  .addTo(map);

              marker.visitData = point;
              markers.push(marker);
          }
      });

      updateStats();
  }

  // ポップアップコンテンツを作成
  function createPopupContent(point) {
      var visited = isVisited(point.id);
      var statusText = visited ? '訪問済み' : '未訪問';
      var buttonText = visited ? '訪問記録を見る' : '訪問記録を追加';

      return '<div>' +
             '<h4>' + point.name + '</h4>' +
             '<p><strong>住所:</strong> ' + point.address + '</p>' +
             '<p><strong>状態:</strong> ' + statusText + '</p>' +
             '<button onclick="openVisitForm(\'' + point.id + '\')" class="btn">' + buttonText +
  '</button>' +
             '</div>';
  }

  // 訪問記録を読み込み
  function loadVisitRecords() {
      // 全ての訪問地のIDについて記録を取得
      visitData.forEach(function(point) {
          getVisitRecords(point.id);
      });
  }

  // 指定した訪問地の記録を取得
  function getVisitRecords(visitId) {
      fetch(CONFIG.GAS_URL, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              action: 'getVisitRecords',
              visitId: visitId,
              token: CONFIG.AUTH_TOKEN
          })
      })
      .then(function(response) {
          return response.json();
      })
      .then(function(data) {
          if (data.success) {
              // 訪問記録を保存
              visitRecords = visitRecords.concat(data.records);
              updateMarkerStyles();
              updateStats();
          }
      })
      .catch(function(error) {
          console.error('訪問記録取得エラー:', error);
      });
  }

  // 訪問済みかチェック
  function isVisited(visitId) {
      return visitRecords.some(function(record) {
          return record.visitId === visitId;
      });
  }

  // マーカーのスタイルを更新
  function updateMarkerStyles() {
      markers.forEach(function(marker) {
          var visited = isVisited(marker.visitData.id);
          if (visited) {
              marker.getElement().classList.add('marker-visited');
          }

          // ポップアップを更新
          marker.setPopupContent(createPopupContent(marker.visitData));
      });
  }

  // チームでフィルター
  function filterByTeam() {
      var selectedTeam = document.getElementById('teamFilter').value;

      markers.forEach(function(marker) {
          var show = true;

          if (selectedTeam) {
              // そのチームが訪問した地点のみ表示
              var teamRecords = visitRecords.filter(function(record) {
                  return record.visitId === marker.visitData.id && record.teamName === selectedTeam;
              });
              show = teamRecords.length > 0;
          }

          if (show) {
              marker.addTo(map);
          } else {
              map.removeLayer(marker);
          }
      });

      updateStats();
  }

  // 統計を更新
  function updateStats() {
      var visibleMarkers = markers.filter(function(marker) {
          return map.hasLayer(marker);
      });

      var totalPoints = visibleMarkers.length;
      var visitedCount = visibleMarkers.filter(function(marker) {
          return isVisited(marker.visitData.id);
      }).length;
      var unvisitedCount = totalPoints - visitedCount;
      var progressRate = totalPoints > 0 ? Math.round((visitedCount / totalPoints) * 100) : 0;

      document.getElementById('totalPoints').textContent = totalPoints;
      document.getElementById('visitedPoints').textContent = visitedCount;
      document.getElementById('unvisitedPoints').textContent = unvisitedCount;
      document.getElementById('progressRate').textContent = progressRate + '%';
  }

  // 訪問フォームを開く
  function openVisitForm(visitId) {
      var point = visitData.find(function(p) {
          return p.id === visitId;
      });

      if (!point) return;

      document.getElementById('visitId').value = visitId;
      document.getElementById('visitName').value = point.name;

      // 既存の記録がある場合は表示
      var existingRecords = visitRecords.filter(function(record) {
          return record.visitId === visitId;
      });

      if (existingRecords.length > 0) {
          // 最新の記録を表示
          var latest = existingRecords[existingRecords.length - 1];
          document.getElementById('teamName').value = latest.teamName;
          document.getElementById('visitor').value = latest.visitor;
          document.getElementById('contact').value = latest.contact;
          document.getElementById('notes').value = latest.notes;
      } else {
          // フォームをクリア
          document.getElementById('teamName').value = '';
          document.getElementById('visitor').value = '';
          document.getElementById('contact').value = '';
          document.getElementById('notes').value = '';
      }

      document.getElementById('overlay').style.display = 'block';
      document.getElementById('visitForm').style.display = 'block';
  }

  // 訪問フォームを閉じる
  function closeVisitForm() {
      document.getElementById('overlay').style.display = 'none';
      document.getElementById('visitForm').style.display = 'none';
  }

  // 訪問記録を送信
  function submitVisitRecord(event) {
      event.preventDefault();

      var formData = new FormData(event.target);
      var data = {
          action: 'addVisitRecord',
          visitId: formData.get('visitId'),
          teamName: formData.get('teamName'),
          visitor: formData.get('visitor'),
          contact: formData.get('contact'),
          notes: formData.get('notes'),
          token: CONFIG.AUTH_TOKEN
      };

      fetch(CONFIG.GAS_URL, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
      })
      .then(function(response) {
          return response.json();
      })
      .then(function(result) {
          if (result.success) {
              alert('訪問記録を登録しました。');
              closeVisitForm();
              // 記録を再読み込み
              getVisitRecords(data.visitId);
          } else {
              alert('エラー: ' + result.error);
          }
      })
      .catch(function(error) {
          console.error('送信エラー:', error);
          alert('送信に失敗しました。');
      });
  }

  // ページ読み込み時にマップを初期化
  document.addEventListener('DOMContentLoaded', function() {
      initMap();
  });
