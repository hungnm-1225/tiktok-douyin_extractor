export const config = {
  maxDuration: 30,
};

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const samples = [
    {
      id: 'douyin-skincare-viral',
      title: 'Douyin Skincare: 3 Bước Trị Mụn Ẩn Cấp Tốc',
      author: 'Linh Trần Beauty (Douyin Creator)',
      category: 'Làm Đẹp & Mỹ Phẩm',
      platform: 'douyin',
      duration: 28,
      coverUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
      description: 'Video triệu view chia sẻ routine trị mụn ẩn bằng Acid Salicylic & cấp ẩm phục hồi.',
      sampleResult: {
        sourceLanguage: 'zh',
        sourceLanguageName: 'Tiếng Trung (Douyin)',
        isVietnamese: false,
        summary: 'Kịch bản hướng dẫn chăm sóc da trị mụn ẩn 3 bước chuẩn Douyin cực viral.',
        toneAndStyle: 'Chia sẻ kinh nghiệm làm đẹp, tự tin, cuốn hút',
        fullOriginalScript: '今天教大家一个三步去闭口的方法，真的超级有用！第一步先用温水洗脸打开毛孔。第二步厚涂水杨酸棉片湿敷三分钟。第三步一定要用修护精华锁住水分。坚持一周，皮肤细腻透亮！',
        fullVietnameseScript: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha! Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông. Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút. Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm. Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!',
        segments: [
          { timestamp: '00:00 - 00:05', startSec: 0, endSec: 5, originalText: '今天教大家一个三步去闭口的方法，真的超级有用！', vietnameseTranslation: 'Hôm nay mình sẽ chỉ cho mọi người phương pháp 3 bước trị mụn ẩn cực kỳ hiệu quả luôn nha!', speaker: 'Người hướng dẫn' },
          { timestamp: '00:05 - 00:10', startSec: 5, endSec: 10, originalText: '第一步先用温水洗脸打开毛孔。', vietnameseTranslation: 'Bước 1: Rửa mặt bằng nước ấm để giãn nở lỗ chân lông.', speaker: 'Người hướng dẫn' },
          { timestamp: '00:10 - 00:16', startSec: 10, endSec: 16, originalText: '第二步厚涂水杨酸棉片湿敷三分钟。', vietnameseTranslation: 'Bước 2: Dùng bông tẩy trang thấm Salicylic Acid đắp nhẹ trong 3 phút.', speaker: 'Người hướng dẫn' },
          { timestamp: '00:16 - 00:23', startSec: 16, endSec: 23, originalText: '第三步一定要用修护精华锁住水分。', vietnameseTranslation: 'Bước 3: Nhất định phải thoa serum phục hồi để khóa ẩm.', speaker: 'Người hướng dẫn' },
          { timestamp: '00:23 - 00:28', startSec: 23, endSec: 28, originalText: '坚持一周，皮肤细腻透亮！', vietnameseTranslation: 'Kiên trì 1 tuần, da sẽ mịn màng và căng bóng rõ rệt!', speaker: 'Người hướng dẫn' },
        ],
        videoMetadata: {
          url: 'https://v.douyin.com/sample1',
          platform: 'douyin',
          title: 'Douyin Skincare: 3 Bước Trị Mụn Ẩn Cấp Tốc',
          author: 'Linh Trần Beauty',
          duration: 28,
        },
      },
    },
    {
      id: 'tiktok-vn-food-review',
      title: 'Review Phố Ẩm Thực Hồ Thị Kỷ - Ăn Sập 10 Món',
      author: 'Ăn Cùng Quỳnh (TikToker)',
      category: 'Ẩm Thực / Review',
      platform: 'tiktok',
      duration: 35,
      coverUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
      description: 'Clip review ẩm thực Sài Gòn sôi động, giọng nói tự nhiên, năng lượng tích cực.',
      sampleResult: {
        sourceLanguage: 'vi',
        sourceLanguageName: 'Tiếng Việt',
        isVietnamese: true,
        summary: 'Review các món ăn vặt hot hit tại chợ Hồ Thị Kỷ với mức giá sinh viên.',
        toneAndStyle: 'Hào hứng, gần gũi, review chân thật',
        fullOriginalScript: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha. Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy. Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi. Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!',
        fullVietnameseScript: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha. Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy. Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi. Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!',
        segments: [
          { timestamp: '00:00 - 00:07', startSec: 0, endSec: 7, originalText: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha.', vietnameseTranslation: 'Hello mọi người! Hôm nay Quỳnh sẽ dắt mọi người đi ăn sập khu phố ẩm thực Hồ Thị Kỷ chỉ với 100 cành nha.', speaker: 'Quỳnh Food' },
          { timestamp: '00:07 - 00:15', startSec: 7, endSec: 15, originalText: 'Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy.', vietnameseTranslation: 'Món đầu tiên chính là thịt xiên nướng phô mai béo ngậy.', speaker: 'Quỳnh Food' },
          { timestamp: '00:15 - 00:25', startSec: 15, endSec: 25, originalText: 'Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi.', vietnameseTranslation: 'Tiếp theo là bánh tráng nướng giòn rụm thơm nức mũi.', speaker: 'Quỳnh Food' },
          { timestamp: '00:25 - 00:35', startSec: 25, endSec: 35, originalText: 'Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!', vietnameseTranslation: 'Cuối cùng tráng miệng bằng ly chè Thái sầu riêng siêu đỉnh!', speaker: 'Quỳnh Food' },
        ],
        videoMetadata: {
          url: 'https://www.tiktok.com/@sample2',
          platform: 'tiktok',
          title: 'Review Phố Ẩm Thực Hồ Thị Kỷ',
          author: 'Ăn Cùng Quỳnh',
          duration: 35,
        },
      },
    },
  ];

  return res.status(200).json({
    success: true,
    samples,
  });
}
