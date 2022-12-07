import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { InjectModel } from '@nestjs/mongoose';
import { Room, RoomDocument } from './room.schema';
import { Model } from 'mongoose';
import { CustomException } from '@common/exceptions/custom.exception';
import { isInKorea } from '@utils/location';
import { RestaurantService } from '@restaurant/restaurant.service';
import { LOCATION_EXCEPTION } from '@response/location';
import { ROOM_EXCEPTION } from '@response/room';
import { RedisService } from '@cache/redis.service';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private restaurantService: RestaurantService,
    private readonly redisService: RedisService
  ) {}

  async createRoom(lat: number, lng: number, radius: number): Promise<string> {
    if (!isInKorea(lat, lng)) {
      throw new CustomException(LOCATION_EXCEPTION.OUT_OF_KOREA);
    }

    try {
      const roomCode = uuid();
      const restaurantMap = await this.restaurantService.getRestaurantList(lat, lng, radius);
      const restaurantDetailList = await Promise.all(
        Object.keys(restaurantMap).map((restaurantId) => {
          const restaurant = restaurantMap[restaurantId];
          const { name, address, lat, lng } = restaurant;
          return this.restaurantService.getRestaurantDetail(restaurantId, address, name, lat, lng);
        })
      );
      const mergedRestaurantDataList = restaurantDetailList.map((restaurantDetailData) => {
        const { id } = restaurantDetailData;
        const restaurantData = restaurantMap[id];
        return { ...restaurantData, ...restaurantDetailData };
      });
      await this.roomModel.create({ roomCode, lat, lng });
      await this.redisService.restaurantList.setRestaurantListForRoom(
        roomCode,
        mergedRestaurantDataList
      );
      await this.redisService.candidateList.createEmptyCandidateListForRoom(
        roomCode,
        mergedRestaurantDataList
      );
      await this.redisService.joinList.createEmptyJoinListForRoom(roomCode);
      return roomCode;
    } catch (error) {
      console.log(error);
      throw new CustomException(ROOM_EXCEPTION.FAIL_CREATE_ROOM);
    }
  }

  async validRoom(roomCode: string): Promise<boolean> {
    try {
      const room = await this.roomModel.findOne({ roomCode });
      if (!room || room.deletedAt) {
        return false;
      }
      const roomDynamic = await this.redisService.restaurantList.getRestaurantListForRoom(roomCode);
      if (!roomDynamic) {
        await this.roomModel.findOneAndUpdate({ roomCode }, { deletedAt: Date.now() });
        return false;
      }

      return !!room && !room.deletedAt;
    } catch (error) {
      throw new CustomException(ROOM_EXCEPTION.FAIL_SEARCH_ROOM);
    }
  }
}
